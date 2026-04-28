import { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { PathParamAwareValidationPipe } from '../pipe/path-param-aware-validation.pipe';

/**
 * NestJS 앱의 공통 설정을 적용
 * main.ts와 E2E 테스트에서 동일한 설정을 사용하기 위해 분리
 */
export function setupApp(app: INestApplication): void {
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new PathParamAwareValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.use(cookieParser());
}
