import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeOrmConfig';
import { WinstonModule } from 'nest-winston';
import { CacheModule } from '@nestjs/cache-manager';
import { redisConfig } from './config/redisConfig';
import { BlogModule } from './blog/blog.module';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import authConfig from './config/authConfig';
import { validationEnv } from './config/validationEnv';
import { HttpExceptionFilter } from './filter/http-exception.filter';
import { winstonConfig } from './config/winstonConfig';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `env/.${process.env.NODE_ENV}.env`,
      load: [authConfig],
      validationSchema: validationEnv,
    }),
    TypeOrmModule.forRootAsync(typeOrmConfig),
    WinstonModule.forRootAsync(winstonConfig),
    CacheModule.registerAsync(redisConfig),
    BlogModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
