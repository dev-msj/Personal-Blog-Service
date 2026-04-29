import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { setupApp } from './config/app-setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Personal Blog')
    .setDescription('Backend service for personal blogging')
    .setVersion('0.1')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT Token',
        in: 'header',
      },
      'accessToken',
    )
    .addCookieAuth('refreshToken')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  setupApp(app);

  // SIGTERM/SIGINT 수신 시 모듈의 OnModuleDestroy 훅을 호출. RedisModule이 ioredis
  // 인스턴스를 quit()으로 graceful 종료하기 위해 필수.
  app.enableShutdownHooks();

  await app.listen(3000);
}
bootstrap();
