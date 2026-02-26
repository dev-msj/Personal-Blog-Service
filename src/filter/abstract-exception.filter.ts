import { HttpStatus, Inject } from '@nestjs/common';
import { Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ErrorCode } from '../constant/error-code.enum';
import { FailureResponse } from '../response/failure-response.dto';

export abstract class AbstractExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    protected readonly logger: Logger,
  ) {}

  protected writeLog(url: string, data: string | object, stack?: string): void {
    this.logger.error(
      JSON.stringify(
        {
          url: url,
          response: data,
          stack: stack?.split('\n'),
        },
        null,
        2,
      ),
    );
  }

  protected sendFailureResponse(
    res: Response,
    code: ErrorCode,
    message: string,
  ): void {
    res.status(HttpStatus.OK).json(new FailureResponse(code, message));
  }
}
