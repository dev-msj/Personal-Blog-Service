import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

// 학습 프로젝트 결정으로 production 환경은 미지원이며 development/test만 분기한다.
// Phase 1 진입 시 운영 마이그레이션 절차 정의가 필요하면 production 분기를 추가한다.
const nodeEnv = process.env.NODE_ENV ?? 'development';
const envFile = nodeEnv === 'test' ? '.test.env' : '.development.env';

dotenv.config({
  path: path.resolve(__dirname, '..', '..', 'env', envFile),
});

const REQUIRED_DB_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
] as const;
const missing = REQUIRED_DB_KEYS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // ConfigModule(validationEnv)이 적용되지 않는 CLI/globalSetup 경로에서도
  // 누락 키를 직접 노출해 mysql2의 모호한 메시지(예: ECONNREFUSED ...:NaN)로
  // 디버깅이 길어지지 않도록 한다.
  throw new Error(
    `[data-source] 필수 DB 환경변수 누락: ${missing.join(', ')} (envFile=${envFile})`,
  );
}

// TypeORM CLI(typeorm-ts-node-commonjs)와 Jest globalSetup 공용 DataSource.
// NestJS DI 외부에서 ts-node로 직접 실행되므로 ts 소스 경로를 참조한다.
// 런타임(빌드 후 dist) DataSource는 src/config/typeOrmConfig.ts에서 별도 정의.
// __dirname(src/config) 기준 절대 경로로 cwd 의존성을 제거한다.
const srcRoot = path.resolve(__dirname, '..');
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [path.join(srcRoot, '**', '*.entity.ts')],
  migrations: [path.join(srcRoot, 'migrations', '*.ts')],
  synchronize: false,
  migrationsRun: false,
});
