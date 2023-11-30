import { DailyRotateFileTransportOptions } from 'winston-daily-rotate-file';

export const dailyOption = (level: string): DailyRotateFileTransportOptions => {
  return {
    level,
    datePattern: 'YYYY-MM-DD',
    dirname: `logs/${level}`,
    filename: `%DATE%.${level}.log`,
    maxFiles: 30,
    zippedArchive: true,
  };
};
