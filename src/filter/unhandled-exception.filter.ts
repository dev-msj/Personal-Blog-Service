import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AbstractExceptionFilter } from './abstract-exception.filter';

@Catch()
export class UnhandledExceptionFilter
  extends AbstractExceptionFilter
  implements ExceptionFilter
{
  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    this.writeLog(
      req.url,
      {
        error: exception.constructor.name,
        message: exception.message,
        otherInfo: JSON.stringify(exception),
      },
      exception.stack,
    );

    this.sendFailureResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Internal Server Error!',
    );
  }
}
