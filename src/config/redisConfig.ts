import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-ioredis';

export const redisConfig: CacheModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    isGlobal: true,
    store: redisStore,
    host: configService.get('REDIS_HOST'),
    port: Number(configService.get('REDIS_PORT')),
    password: configService.get('REDIS_PASSWORD'),
    no_ready_check: true,
  }),
};
