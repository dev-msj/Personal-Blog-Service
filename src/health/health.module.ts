import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TerminusModule } from '@nestjs/terminus';
import { redisConfig } from '../config/redisConfig';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicator/redis.health-indicator';

// HealthModule 자기완결성: AppModule 등록 또는 E2E override 환경에서 CacheModule store가
// in-memory로 교체되면 RedisHealthIndicator의 cacheManager.store.getClient()가 미정의되어
// TypeError가 발생한다. HealthModule이 자체 CacheModule(redisConfig)을 직접 등록하여 차단한다.
@Module({
  imports: [TerminusModule, CacheModule.registerAsync(redisConfig)],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
