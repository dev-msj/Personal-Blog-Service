import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeOrmConfig';
import { WinstonModule } from 'nest-winston';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import type * as Redis from 'ioredis';
import { redisConfig } from './config/redisConfig';
import { BlogModule } from './blog/blog.module';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import authConfig from './config/authConfig';
import { validationEnv } from './config/validationEnv';
import { UnhandledExceptionFilter } from './filter/unhandled-exception.filter';
import { HttpExceptionFilter } from './filter/http-exception.filter';
import { BaseExceptionFilter } from './filter/base-exception.filter';
import { winstonConfig } from './config/winstonConfig';
import { UserModule } from './user/user.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { REDIS_CLIENT } from './redis/redis.providers';
import { RedisThrottlerStorage } from './throttler/redis-throttler.storage';
import { CustomThrottlerGuard } from './throttler/custom-throttler.guard';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { IdempotencyKeyInterceptor } from './interceptor/idempotency-key.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `env/.${process.env.NODE_ENV}.env`,
      load: [authConfig],
      validationSchema: validationEnv,
    }),
    TypeOrmModule.forRootAsync(typeOrmConfig),
    WinstonModule.forRootAsync(winstonConfig),
    CacheModule.registerAsync(redisConfig),
    // 전역 Rate Limiting. storage는 단일 REDIS_CLIENT(ioredis@4)를 재사용하는
    // 직접 구현(RedisThrottlerStorage). 기본 제한값은 security.md §5.2 [확정]
    // 읽기 API(IP 분당 200회)이며 env로 조정 가능(Phase 4 부하 테스트 [가이드]).
    // 카운트 단위: base ThrottlerGuard.generateKey가 (클래스·핸들러·throttler명·tracker)
    // 해시로 키를 만들므로 제한은 '(tracker, 엔드포인트)별'로 적용된다(@nestjs/throttler
    // 기본 동작). 경로별 명시 정책은 V2에서 @Throttle로 정리.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT, ConfigService],
      useFactory: (redis: Redis.Redis, configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: Number(configService.get('THROTTLE_DEFAULT_TTL', 60000)),
            limit: Number(configService.get('THROTTLE_DEFAULT_LIMIT', 200)),
          },
        ],
        storage: new RedisThrottlerStorage(redis),
        // 테스트 환경에서는 전역 throttle을 코드로 비활성화한다. 다수 e2e spec이
        // 동일 IP 트래커를 공유하므로(git 미추적 .test.env 값에 의존하지 않도록)
        // 결정적으로 skip. throttle 동작 검증은 throttler.e2e-spec이 옵션을
        // 오버라이드(skipIf 미포함)하여 격리 수행한다.
        skipIf: () => process.env.NODE_ENV === 'test',
      }),
    }),
    BlogModule,
    UserModule,
    HealthModule,
    IdempotencyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 전역 Idempotency-Key 처리 인터셉터. AuthGuard 후행(NestJS Guard→Interceptor
    // 순서로 authenticatedUser 신뢰 헤더 주입 후 실행). DT-1 R1~R4 + 키 충돌 분기는
    // flows/idempotency-key-handle.md.
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyKeyInterceptor,
    },
    // Guard 실행 순서(등록 순): AuthGuard → CustomThrottlerGuard.
    // AuthGuard가 먼저 req.headers['authenticatedUser'](uid)를 주입해야
    // CustomThrottlerGuard.getTracker가 인증 요청을 user_id로 식별한다.
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    // 필터 실행 순서: BaseException → HttpException → Unhandled (NestJS는 등록 역순으로 실행)
    {
      provide: APP_FILTER,
      useClass: UnhandledExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: BaseExceptionFilter,
    },
  ],
})
export class AppModule {}
