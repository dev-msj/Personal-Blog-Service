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

/**
 * Idempotency-Key 통합 + 동시성 검증 (flows/idempotency-key-handle.md §6).
 *
 * - TC-IDEM-04: §3.1 동일 키 + 다른 method/path → COMMON_BAD_REQUEST (+ Warning 로그)
 * - 동시성: 동일 키 동시 N요청 → SET NX 락은 1건만 획득, 나머지는 R4(IN_PROGRESS)
 *
 * 실 Redis(6380)/MySQL(3307) 컨테이너 사용. 병렬 implementer 모드에서는 작성만 하고
 * 실행은 오케스트레이터가 직렬 수행한다 (컨테이너 공유 싱글톤 race 회피).
 */
describe('Idempotency-Key Integration & Concurrency (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let dbCleaner: DbCleaner;
  let authHelper: AuthHelper;

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

  const authedPost = (path: string, key: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', authHelper.getAuthHeader())
      .set('Cookie', authHelper.getRefreshToken())
      .set('Idempotency-Key', key);

  describe('TC-IDEM-04 §3.1 키 충돌 (동일 키, 다른 method/path)', () => {
    it('동일 키를 다른 path에 재사용하면 COMMON_BAD_REQUEST를 반환한다', async () => {
      await authHelper.createTestUser('idem04@example.com', 'Password123!');
      const key = randomUUID();

      const first = await authedPost('/posts', key).send({
        title: 't',
        contents: 'c',
      });
      expect(first.status).toBe(201);

      // 같은 키, 다른 path(다른 엔드포인트)로 재사용
      const reuse = await authedPost('/posts/1/likes', key).send({});

      expect(reuse.status).toBe(200);
      expect(reuse.body.code).toBe(ErrorCode.COMMON_BAD_REQUEST);
    });
  });

  describe('동시성 — 동일 키 동시 요청', () => {
    it('동일 키로 동시 N요청 시 부작용은 정확히 1회(글 1건)이고 모든 응답이 유효하다', async () => {
      await authHelper.createTestUser('idemcc@example.com', 'Password123!');
      const key = randomUUID();

      const N = 5;
      const responses = await Promise.all(
        Array.from({ length: N }, () =>
          authedPost('/posts', key).send({ title: 't', contents: 'c' }),
        ),
      );

      // 멱등성의 핵심 불변식: 부작용 정확히 1회. SET NX EX Lua 원자 락으로
      // 핸들러는 1회만 실행되어 글이 1건만 생성된다.
      const list = await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken());
      expect(list.body.data).toHaveLength(1);

      // 각 응답은 success(code 200) 또는 IN_PROGRESS 둘 중 하나로만 유효.
      // 처리 완료 전 도착분은 R4(IN_PROGRESS), 완료 후 도착분은 R3(success 재반환).
      const success = responses.filter(
        (r: request.Response) => r.body.code === 200,
      );
      const inProgress = responses.filter(
        (r: request.Response) =>
          r.body.code === ErrorCode.IDEMPOTENCY_IN_PROGRESS,
      );
      expect(success.length + inProgress.length).toBe(N);

      // R2 처리분이 최소 1건 존재하고, 모든 success 응답은 동일(멱등 동일 응답).
      expect(success.length).toBeGreaterThanOrEqual(1);
      const firstSuccessBody = success[0].body;
      success.forEach((r: request.Response) => {
        expect(r.body).toEqual(firstSuccessBody);
      });

      // 모든 IN_PROGRESS 응답은 Retry-After:5 헤더 보유.
      inProgress.forEach((r: request.Response) => {
        expect(r.headers['retry-after']).toBe('5');
      });
    });
  });
});
