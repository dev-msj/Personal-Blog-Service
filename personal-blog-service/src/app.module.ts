import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeOrmConfig';
import { WinstonModule, utilities } from 'nest-winston';
import * as winston from 'winston';
import { CacheModule } from '@nestjs/cache-manager';
import { redisConfig } from './config/redisConfig';
import { BlogModule } from './blog/blog.module';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import authConfig from './config/authConfig';
import { validationEnv } from './config/validationEnv';
import { HttpExceptionFilter } from './filter/http-exception.filter';
import * as winstonDaily from 'winston-daily-rotate-file';
import { dailyOption } from './config/dailyLogConfig';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `env/.${process.env.NODE_ENV}.env`,
      load: [authConfig],
      validationSchema: validationEnv,
    }),
    TypeOrmModule.forRootAsync(typeOrmConfig),
    WinstonModule.forRoot({
      format: winston.format.combine(
        winston.format.timestamp(),
        utilities.format.nestLike('PersonalBlog', { prettyPrint: true }),
      ),
      transports: [
        new winston.transports.Console({
          level: process.env.NODE_ENV === 'production' ? 'info' : 'silly',
        }),
        new winstonDaily(dailyOption('info')),
        new winstonDaily(dailyOption('error')),
      ],
    }),
    CacheModule.registerAsync(redisConfig),
    BlogModule,
    AuthModule,
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
