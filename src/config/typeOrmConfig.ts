import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';

export const typeOrmConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const isTestEnv = configService.get('NODE_ENV') === 'test';

    return {
      type: 'mysql',
      host: configService.get('DB_HOST'),
      port: Number(configService.get('DB_PORT')),
      username: configService.get('DB_USERNAME'),
      password: configService.get('DB_PASSWORD'),
      database: configService.get('DB_DATABASE'),
      autoLoadEntities: true,
      synchronize: configService.get('DB_SYNCHRONIZE') === 'true',
      // 테스트 환경에서는 Redis 캐시를 비활성화
      cache: isTestEnv
        ? false
        : {
            type: 'redis',
            options: {
              host: configService.get('REDIS_HOST'),
              port: Number(configService.get('REDIS_PORT')),
              password: configService.get('REDIS_PASSWORD'),
            },
            ignoreErrors: true,
          },
    };
  },
};
