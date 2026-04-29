import * as path from 'path';
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
      // synchronize: false 강제. 스키마 변경은 migration 파일로만 적용한다.
      synchronize: false,
      migrationsRun: false,
      // NestJS 런타임은 빌드된 dist 경로 참조. CLI/globalSetup용 경로는
      // src/config/data-source.ts(ts-node 직접 실행)에서 별도 관리한다.
      // __dirname(dist/src/config) 기준 절대 경로로 cwd 의존성을 제거한다.
      migrations: [path.join(__dirname, '..', 'migrations', '*.js')],
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
