import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { DbCleaner, Tables } from './utils/db-cleaner';
import { AuthHelper } from './utils/auth-helper';
import { setupApp } from '../src/config/app-setup';
import { ErrorCode } from '../src/constant/error-code.enum';
import { REDIS_CLIENT } from '../src/redis/redis.providers';
import type * as Redis from 'ioredis';

/**
 * Idempotency-Key 계약 검증 (flows/idempotency-key-handle.md §6 테스트 매핑).
 *
 * - TC-IDEM-01: DT-1 R2 (키 + miss → 처리 후 캐싱)
 * - TC-IDEM-03: DT-1 R3 (키 + hit-stored → 원본 응답 재반환, Service 미호출)
 * - TC-IDEM-05: DT-1 R4 (키 + pending → IDEMPOTENCY_IN_PROGRESS + Retry-After 5)
 * - TC-IDEM-06: §3.3 핸들러 throw 시 실패 응답 캐싱 → 재요청 동일 응답
 *
 * 실 Redis(6380)/MySQL(3307) 컨테이너 사용. 병렬 implementer 모드에서는 컨테이너가
 * 호스트 공유 싱글톤이므로 본 스위트는 작성만 하고 실행은 오케스트레이터가 직렬 수행한다.
 */
describe('Idempotency-Key Contract (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let dbCleaner: DbCleaner;
  let authHelper: AuthHelper;
  let redis: Redis.Redis;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(CacheModule.register({ isGlobal: true }))
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    dbCleaner = new DbCleaner(dataSource);
    authHelper = new AuthHelper(app);
    redis = moduleFixture.get<Redis.Redis>(REDIS_CLIENT);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dbCleaner.cleanTables([
      Tables.POST_LIKE,
      Tables.POST,
      Tables.USER_INFO,
      Tables.USER_AUTH,
    ]);
    await dbCleaner.cleanCache();
  });

  const authedPost = (path: string, key?: string) => {
    const req = request(app.getHttpServer())
      .post(path)
      .set('Authorization', authHelper.getAuthHeader())
      .set('Cookie', authHelper.getRefreshToken());
    if (key) {
      req.set('Idempotency-Key', key);
    }
    return req;
  };

  describe('TC-IDEM-01 DT-1 R2 (키 + miss → 처리 후 캐싱)', () => {
    it('키 제공 신규 요청은 처리되고 completed 캐시가 생성된다', async () => {
      await authHelper.createTestUser('idem01@example.com', 'Password123!');
      const key = randomUUID();

      const res = await authedPost('/posts', key).send({
        title: 't',
        contents: 'c',
      });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe(200);

      // 인증 식별자(uid) 네임스페이스로 completed 캐시 존재 확인
      const cached = await redis.get(`idempotency:idem01@example.com:${key}`);
      expect(cached).not.toBeNull();
      const parsed = JSON.parse(cached as string);
      expect(parsed.state).toBe('completed');
      expect(parsed.method).toBe('POST');
      expect(parsed.path).toBe('/posts');
    });
  });

  describe('TC-IDEM-03 DT-1 R3 (키 + hit-stored → 재반환)', () => {
    it('동일 키 재요청은 새 글을 만들지 않고 저장된 응답을 재반환한다', async () => {
      await authHelper.createTestUser('idem03@example.com', 'Password123!');
      const key = randomUUID();

      const first = await authedPost('/posts', key).send({
        title: 't',
        contents: 'c',
      });
      expect(first.status).toBe(201);

      const second = await authedPost('/posts', key).send({
        title: 't',
        contents: 'c',
      });

      // 동일 응답 재반환 (body 일치)
      expect(second.body).toEqual(first.body);

      // 글 목록은 1건만 — 핸들러 재진입 없음(Service 미호출)
      const list = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken());
      expect(list.body.data).toHaveLength(1);
    });
  });

  describe('TC-IDEM-05 DT-1 R4 (키 + pending → IN_PROGRESS)', () => {
    it('pending 상태 키 재요청은 IDEMPOTENCY_IN_PROGRESS + Retry-After:5를 반환한다', async () => {
      await authHelper.createTestUser('idem05@example.com', 'Password123!');
      const key = randomUUID();

      // pending 상태를 직접 심어 in-flight를 시뮬레이션
      await redis.set(
        `idempotency:idem05@example.com:${key}`,
        JSON.stringify({
          state: 'pending',
          method: 'POST',
          path: '/posts',
          processedAt: new Date().toISOString(),
        }),
        'EX',
        86400,
      );

      const res = await authedPost('/posts', key).send({
        title: 't',
        contents: 'c',
      });

      expect(res.body.code).toBe(ErrorCode.IDEMPOTENCY_IN_PROGRESS);
      expect(res.headers['retry-after']).toBe('5');
    });
  });

  describe('TC-IDEM-06 §3.3 핸들러 throw 시 실패 응답 캐싱', () => {
    it('실패 응답이 캐싱되고 같은 키 재요청은 동일 실패 응답을 재반환한다', async () => {
      // flow §3.3 정상 경로: 핸들러 throw 시 실패 스냅샷을 completed(failed)로 캐싱하고
      // 같은 키 재요청은 R3에서 동일 실패 응답을 재반환한다(성공/실패 무관 같은 결과 보장).
      await authHelper.createTestUser('idem06@example.com', 'Password123!');
      const key = randomUUID();

      // 존재하지 않는 글 좋아요 → 도메인 실패. HTTP 200 + FailureResponse로 변환된다.
      const first = await authedPost('/posts/999999/likes', key).send({});
      expect(first.status).toBe(200);
      expect(first.body.code).not.toBe(200); // 실패 응답
      expect(first.body.code).not.toBe(ErrorCode.IDEMPOTENCY_IN_PROGRESS);

      // 실패 스냅샷이 completed(failed)로 캐싱됨
      const cached = await redis.get(`idempotency:idem06@example.com:${key}`);
      expect(cached).not.toBeNull();
      const parsed = JSON.parse(cached as string);
      expect(parsed.state).toBe('completed');
      expect(parsed.failed).toBe(true);

      // 같은 키·같은 path 재요청 → 동일 실패 응답 재반환(R3), IN_PROGRESS 아님
      const second = await authedPost('/posts/999999/likes', key).send({});
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
      expect(second.body.code).not.toBe(ErrorCode.IDEMPOTENCY_IN_PROGRESS);
    });
  });
});
