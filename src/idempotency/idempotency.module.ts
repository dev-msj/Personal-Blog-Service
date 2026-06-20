import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { IdempotencyService } from './idempotency.service';

/**
 * API 수신 측 Idempotency-Key 처리 모듈.
 *
 * RedisModule을 import하여 REDIS_CLIENT(단일 ioredis Provider, #86)를 주입받고,
 * IdempotencyService를 export하여 전역 IdempotencyKeyInterceptor가 활용한다.
 */
@Module({
  imports: [RedisModule],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
