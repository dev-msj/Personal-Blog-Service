import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import * as Redis from 'ioredis';
import { redisClientProvider, REDIS_CLIENT } from './redis.providers';

@Module({
  providers: [redisClientProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis.Redis) {}

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
