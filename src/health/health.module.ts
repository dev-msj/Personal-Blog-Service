import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TerminusModule } from '@nestjs/terminus';
import { redisConfig } from '../config/redisConfig';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicator/redis.health-indicator';

// AppModule 전역 CacheModule이 E2E moduleFixture에서 in-memory store로 override되어
// RedisHealthIndicator의 cacheManager.store.getClient()가 미정의되는 문제를 차단하기 위해
// HealthModule이 자체 CacheModule(redisConfig)을 직접 등록한다.
@Module({
  imports: [TerminusModule, CacheModule.registerAsync(redisConfig)],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
