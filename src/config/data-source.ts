import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const envFile = nodeEnv === 'test' ? '.test.env' : '.development.env';

dotenv.config({
  path: path.resolve(__dirname, '..', '..', 'env', envFile),
});

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
