import { WinstonModuleAsyncOptions, utilities } from 'nest-winston';
import * as winston from 'winston';
import * as winstonDaily from 'winston-daily-rotate-file';

export const winstonConfig: WinstonModuleAsyncOptions = {
  useFactory: () => {
    return {
      format: winston.format.combine(
        winston.format.timestamp(),
        utilities.format.nestLike('PersonalBlog', { prettyPrint: true }),
      ),
      transports: [
        new winston.transports.Console({
          level: process.env.NODE_ENV === 'production' ? 'info' : 'silly',
        }),
        process.env.NODE_ENV === 'production'
          ? new winstonDaily(dailyOption('error'))
          : new winstonDaily(dailyOption('info')),
      ],
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
