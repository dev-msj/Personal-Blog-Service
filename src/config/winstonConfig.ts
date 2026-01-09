import { WinstonModuleAsyncOptions, utilities } from 'nest-winston';
import * as winston from 'winston';
import * as winstonDaily from 'winston-daily-rotate-file';

export const winstonConfig: WinstonModuleAsyncOptions = {
  useFactory: () => {
    const isTestEnv = process.env.NODE_ENV === 'test';
    const isProdEnv = process.env.NODE_ENV === 'production';

    const transports: winston.transport[] = [
      new winston.transports.Console({
        level: isProdEnv ? 'info' : 'silly',
      }),
    ];

    // 테스트 환경에서는 파일 로거를 비활성화 (Jest 종료 문제 방지)
    if (!isTestEnv) {
      transports.push(
        isProdEnv
          ? new winstonDaily(dailyOption('error'))
          : new winstonDaily(dailyOption('info')),
      );
    }

    return {
      format: winston.format.combine(
        winston.format.timestamp(),
        utilities.format.nestLike('PersonalBlog', { prettyPrint: true }),
      ),
      transports,
    };
  },
};

const dailyOption = (
  level: string,
): winstonDaily.DailyRotateFileTransportOptions => {
  return {
    level,
    datePattern: 'YYYY-MM-DD',
    dirname: `logs/${level}`,
    filename: `%DATE%.${level}.log`,
    maxFiles: 30,
    zippedArchive: true,
  };
};
