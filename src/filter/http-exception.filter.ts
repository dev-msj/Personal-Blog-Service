import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AbstractExceptionFilter } from './abstract-exception.filter';

@Catch(HttpException)
export class HttpExceptionFilter
  extends AbstractExceptionFilter
  implements ExceptionFilter
{
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const response = exception.getResponse();

    this.writeLog(req.url, response, exception.stack);

    this.sendFailureResponse(
      res,
      exception.getStatus(),
      this.getMessage(response),
    );
  }

  private getMessage(response: string | object): string {
    if (typeof response === 'string') {
      return response;
    }

    const message = (response as Record<string, unknown>).message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    return typeof message === 'string' ? message : '';
  }
}
