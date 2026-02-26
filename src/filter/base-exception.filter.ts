import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseException } from '../exception/base.exception';
import { AbstractExceptionFilter } from './abstract-exception.filter';

@Catch(BaseException)
export class BaseExceptionFilter
  extends AbstractExceptionFilter
  implements ExceptionFilter
{
  catch(exception: BaseException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    this.writeLog(
      req.url,
      {
        errorCode: exception.errorCode,
        message: exception.message,
        value: exception.value,
      },
      exception.stack,
    );

    this.sendFailureResponse(res, exception.errorCode, exception.message);
  }
}
