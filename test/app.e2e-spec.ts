import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/config/app-setup';

describe('AppController (e2e)', () => {
  let app: INestApplication;

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
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  // RedisHealthIndicator가 CacheModule(@nestjs/cache-manager) 대신 REDIS_CLIENT를 직접 inject
  // 받음을 보장. AppModule 부트 환경에서 CacheModule.overrideModule()로 in-memory 캐시로
  // 교체된 상태에서도 health 경로가 실 ioredis 연결로 동작해야 한다 (#67/#77/#86 회귀 방지).
  it('GET /health → CacheModule override 환경에서도 redis up 상태를 반환한다', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      details: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });
});
