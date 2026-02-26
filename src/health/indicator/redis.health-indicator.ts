import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';

interface IoRedisCacheManager {
  store: {
    getClient(): { ping(): Promise<string> };
  };
}

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: IoRedisCacheManager,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const client = this.cacheManager.store.getClient();
      await client.ping();
      return this.getStatus(key, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HealthCheckError(
        `Redis health check failed: ${message}`,
        this.getStatus(key, false),
      );
    }
  }
}
