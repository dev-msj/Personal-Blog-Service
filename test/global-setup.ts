import * as dotenv from 'dotenv';
import * as path from 'path';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';
  dotenv.config({
    path: path.resolve(__dirname, '..', 'env', '.test.env'),
  });

  const { default: dataSource } = await import('../src/config/data-source');

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await dataSource.initialize();
      try {
        await dataSource.runMigrations();
      } finally {
        await dataSource.destroy();
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_RETRIES) break;
      await sleep(RETRY_DELAY_MS);
    }
  }

  console.error(
    '[E2E globalSetup] DataSource 초기화 실패. 테스트 컨테이너가 기동되었는지 확인하세요: ' +
      'docker-compose -f docker-compose.test.yaml up -d',
  );
  throw lastError;
}
