import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const envFile = nodeEnv === 'test' ? '.test.env' : '.development.env';

dotenv.config({
  path: path.resolve(__dirname, '..', '..', 'env', envFile),
});

// TypeORM CLI(typeorm-ts-node-commonjs)와 Jest globalSetup 공용 DataSource.
// NestJS DI 외부에서 ts-node로 직접 실행되므로 ts 소스 경로를 참조한다.
// 런타임(빌드 후 dist) DataSource는 src/config/typeOrmConfig.ts에서 별도 정의.
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: ['src/**/*.entity.ts'],
  migrations: ['migrations/*.ts'],
  synchronize: false,
  migrationsRun: false,
});
