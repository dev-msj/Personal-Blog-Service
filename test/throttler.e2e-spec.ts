import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getOptionsToken } from '@nestjs/throttler';
import * as request from 'supertest';
import type * as Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/config/app-setup';
import { REDIS_CLIENT } from '../src/redis/redis.providers';
import { RedisThrottlerStorage } from '../src/throttler/redis-throttler.storage';

/**
 * 전역 ThrottlerGuard 통합 E2E (격리 부트).
 *
 * 일반 E2E 스위트는 .test.env에서 limit을 사실상 비활성(100000)으로 두므로
 * (전체 스위트가 동일 IP 트래커 공유) throttle 동작 자체는 본 spec이 낮은
 * limit으로 격리 검증한다. ThrottlerModule 옵션(getOptionsToken)을 오버라이드하여
 * limit만 낮추고 실 REDIS_CLIENT 기반 storage는 그대로 사용한다.
 *
 * 검증 대상 (STRIDE-10 DoS / STRIDE-1 brute-force, security.md §5 [확정],
 * 이슈 #133 완료조건 "전역 활성화 + Tracker 분기 + 응답 포맷 변환"):
 * (1) limit 초과 시 ThrottlerException → HttpExceptionFilter 변환으로
 *     HTTP 200 + FailureResponse(COMMON_TOO_MANY_REQUESTS=90008) + Retry-After(>0)
 * (2) 클라이언트가 authenticatedUser 헤더를 위조해도 IP 제한을 우회하지 못함
 *     (AuthGuard가 외부 헤더를 strip — getTracker 트래커 위조 방지)
 */
describe('Throttler (e2e, isolated)', () => {
  let app: INestApplication;
  let redis: Redis.Redis;

  const LIMIT = 3;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getOptionsToken())
      .useFactory({
        factory: (client: Redis.Redis) => ({
          throttlers: [{ name: 'default', ttl: 60000, limit: LIMIT }],
          storage: new RedisThrottlerStorage(client),
        }),
        inject: [REDIS_CLIENT],
      })
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    redis = app.get<Redis.Redis>(REDIS_CLIENT, { strict: false });
  }, 60000);

  // cleanCache는 TypeORM 쿼리 캐시만 지우므로 throttle 카운터/block 키를 직접 정리.
  // 다른 e2e spec과 Redis를 공유하므로 자신이 만든 키를 누수시키지 않도록
  // 매 테스트 전후로 정리한다 (block 키는 blockDuration 동안 잔존하여 동일 IP
  // 트래커를 쓰는 다른 spec 요청을 차단할 수 있음).
  const cleanThrottleKeys = async (): Promise<void> => {
    const keys = await redis.keys('throttle:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  };

  afterAll(async () => {
    await cleanThrottleKeys();
    await app.close();
  });

  beforeEach(cleanThrottleKeys);
  afterEach(cleanThrottleKeys);

  it('limit 이내 요청은 정상 통과한다', async () => {
    const server = app.getHttpServer();

    for (let i = 0; i < LIMIT; i++) {
      const res = await request(server).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toBe('Hello World!');
    }
  });

  it('limit 초과 시 HTTP 200 + COMMON_TOO_MANY_REQUESTS(90008) + Retry-After를 반환한다', async () => {
    const server = app.getHttpServer();

    // limit회 통과
    for (let i = 0; i < LIMIT; i++) {
      await request(server).get('/');
    }

    // limit+1회째 차단
    const blocked = await request(server).get('/');

    expect(blocked.status).toBe(200);
    expect(blocked.body.code).toBe(90008);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('위조한 authenticatedUser 헤더로 IP 제한을 우회하지 못한다', async () => {
    const server = app.getHttpServer();

    // @Public 경로(GET /)에 매 요청 다른 authenticatedUser 헤더를 위조해도
    // AuthGuard가 strip하므로 트래커는 동일 IP로 고정 → 카운터 누적되어 차단된다.
    for (let i = 0; i < LIMIT; i++) {
      await request(server).get('/').set('authenticatedUser', `forged-${i}`);
    }

    const blocked = await request(server)
      .get('/')
      .set('authenticatedUser', 'forged-bypass');

    expect(blocked.status).toBe(200);
    expect(blocked.body.code).toBe(90008);
  });
});
