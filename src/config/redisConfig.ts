import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import * as Redis from 'ioredis';
import * as redisStore from 'cache-manager-ioredis';
import { RedisModule } from '../redis/redis.module';
import { REDIS_CLIENT } from '../redis/redis.providers';

// 단일 ioredis 인스턴스(REDIS_CLIENT)를 cache-manager-ioredis가 새 클라이언트 생성 없이
// 그대로 사용하도록 redisInstance 옵션으로 전달한다 (cache-manager-ioredis index.js:6).
// 이로써 비즈니스 캐시 경로와 health 경로가 동일 ioredis 연결을 공유한다.
export const redisConfig: CacheModuleAsyncOptions = {
  isGlobal: true,
  imports: [RedisModule],
  inject: [REDIS_CLIENT],
  useFactory: (redisInstance: Redis.Redis) => ({
    store: redisStore,
    redisInstance,
  }),
};
