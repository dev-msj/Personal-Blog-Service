import * as dotenv from 'dotenv';
import * as path from 'path';

const MAX_INITIALIZE_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

// 자격증명/권한/DB명 오류 등 영구 원인. 재시도해도 동일하게 실패하므로 즉시 노출한다.
const PERMANENT_DB_ERROR_CODES = new Set([
  'ER_ACCESS_DENIED_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ENOTFOUND',
]);

function isPermanentDbError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return typeof code === 'string' && PERMANENT_DB_ERROR_CODES.has(code);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';
  dotenv.config({
    path: path.resolve(__dirname, '..', 'env', '.test.env'),
  });

  const { default: dataSource } = await import('../src/config/data-source');

  // Jest globalSetup은 실행당 한 번만 호출되고 매 실행이 새 Node 프로세스이므로
  // 이 가드는 이론상 거의 트리거되지 않는다. 모듈 캐시 재사용 환경의 안전망 용도.
  if (dataSource.isInitialized) {
    return;
  }

  // initialize 실패는 컨테이너 미기동/네트워크 등 일시적 원인일 수 있어 재시도.
  // 단, 자격증명/권한/DB명 오류 같은 영구 원인은 즉시 노출하여 디버깅 시간 절약.
  // runMigrations 실패는 SQL 오류 등 영구 원인이므로 재시도 없이 즉시 노출.
  let initializeError: unknown = null;
  for (let attempt = 1; attempt <= MAX_INITIALIZE_RETRIES; attempt++) {
    try {
      await dataSource.initialize();
      initializeError = null;
      break;
    } catch (error) {
      initializeError = error;
      if (isPermanentDbError(error)) break;
      if (attempt === MAX_INITIALIZE_RETRIES) break;
      await sleep(RETRY_DELAY_MS);
    }
  }

  if (initializeError) {
    console.error(
      '[E2E globalSetup] DataSource 초기화 실패. 테스트 컨테이너 미기동 또는 ' +
        'env/.test.env의 자격증명/DB명을 확인하세요: ' +
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
