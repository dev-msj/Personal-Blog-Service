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
    it('동일 키로 동시 N요청 시 1건만 처리되고 나머지는 IN_PROGRESS이다', async () => {
      await authHelper.createTestUser('idemcc@example.com', 'Password123!');
      const key = randomUUID();

      const N = 5;
      const responses = await Promise.all(
        Array.from({ length: N }, () =>
          authedPost('/posts', key).send({ title: 't', contents: 'c' }),
        ),
      );

      // SET NX 락은 단 1건만 획득 → 1건 성공(201/code 200), 나머지는 IN_PROGRESS
      const success = responses.filter(
        (r: request.Response) => r.body.code === 200,
      );
      const inProgress = responses.filter(
        (r: request.Response) =>
          r.body.code === ErrorCode.IDEMPOTENCY_IN_PROGRESS,
      );

      expect(success.length).toBe(1);
      expect(inProgress.length).toBe(N - 1);
      inProgress.forEach((r: request.Response) => {
        expect(r.headers['retry-after']).toBe('5');
      });
    });
  });
});
