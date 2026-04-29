import * as dotenv from 'dotenv';
import * as path from 'path';

const MAX_INITIALIZE_RETRIES = 5;
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

  if (dataSource.isInitialized) {
    return;
  }

  // initialize 실패는 컨테이너 미기동/네트워크 등 일시적 원인일 수 있어 재시도.
  // runMigrations 실패는 SQL 오류 등 영구 원인이므로 재시도 없이 즉시 노출.
  let initializeError: unknown = null;
  for (let attempt = 1; attempt <= MAX_INITIALIZE_RETRIES; attempt++) {
    try {
      await dataSource.initialize();
      initializeError = null;
      break;
    } catch (error) {
      initializeError = error;
      if (attempt === MAX_INITIALIZE_RETRIES) break;
      await sleep(RETRY_DELAY_MS);
    }
  }

  if (initializeError) {
    console.error(
      '[E2E globalSetup] DataSource 초기화 실패. 테스트 컨테이너가 기동되었는지 확인하세요: ' +
        'docker-compose -f docker-compose.test.yaml up -d',
    );
    throw initializeError;
  }

  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
