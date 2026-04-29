import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { RedisModule } from '../redis/redis.module';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicator/redis.health-indicator';

// HealthModule 자기완결성: RedisModule을 직접 import하여 REDIS_CLIENT를 inject 받는다.
// CacheModule은 의존하지 않으므로 다른 spec의 CacheModule override 정책과 무관하게 동작한다.
@Module({
  imports: [TerminusModule, RedisModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
