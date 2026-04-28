import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import * as request from 'supertest';
import { HealthModule } from '../src/health/health.module';
import { typeOrmConfig } from '../src/config/typeOrmConfig';
import { winstonConfig } from '../src/config/winstonConfig';
import { validationEnv } from '../src/config/validationEnv';
import { setupApp } from '../src/config/app-setup';

/**
 * HealthModule 자기완결성 검증 E2E.
 * AppModule 또는 BlogModule/UserModule을 import하지 않는 minimal moduleFixture로 부트하여
 * HealthModule이 다른 모듈의 전역 CacheModule 등록에 의존하지 않음을 검증한다 (#77 / #67).
 *
 * 본 spec은 HealthModule 자기완결성만 다룬다. AppModule 전역 AuthGuard + @Public() 우회 경로의
 * 운영 흐름은 본 격리 부트의 검증 대상이 아니며, 그 회귀는 별도 통합 E2E에서 다룬다.
 */
describe('Health API (e2e, isolated)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: `env/.${process.env.NODE_ENV}.env`,
          validationSchema: validationEnv,
        }),
        TypeOrmModule.forRootAsync(typeOrmConfig),
        WinstonModule.forRootAsync(winstonConfig),
        HealthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → 200 + database/redis 모두 up 상태를 반환한다', async () => {
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
