import * as dotenv from 'dotenv';
import * as path from 'path';

// 테스트 환경 변수를 먼저 로드 (ConfigModule 로드 전에 process.env에 설정)
dotenv.config({
  path: path.resolve(__dirname, '../env/.test.env'),
});

// dotenv 로드 후 NODE_ENV 설정 (ConfigModule이 .test.env를 로드하도록)
process.env.NODE_ENV = 'test';
