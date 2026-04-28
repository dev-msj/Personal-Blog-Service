import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

// AppModule의 CacheModule(@nestjs/cache-manager + cache-manager-ioredis)과
// HealthModule의 RedisHealthIndicator가 공유하는 단일 ioredis 인스턴스.
// cache-manager-ioredis의 redisStore는 args[0].redisInstance가 주어지면 새 클라이언트를
// 만들지 않고 이 인스턴스를 그대로 사용한다(cache-manager-ioredis index.js).
export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Redis.Redis => {
    return new Redis({
      host: configService.get<string>('REDIS_HOST'),
      port: Number(configService.get<string>('REDIS_PORT')),
      password: configService.get<string>('REDIS_PASSWORD'),
    });
  },
};
