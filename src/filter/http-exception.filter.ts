import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../constant/error-code.enum';
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
      this.mapToErrorCode(exception.getStatus()),
      this.getMessage(response),
    );
  }

  private mapToErrorCode(status: number): ErrorCode {
    const mapping: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.COMMON_BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.COMMON_UNAUTHORIZED,
      [HttpStatus.NOT_FOUND]: ErrorCode.COMMON_NOT_FOUND,
      [HttpStatus.NOT_ACCEPTABLE]: ErrorCode.COMMON_NOT_ACCEPTABLE,
      [HttpStatus.CONFLICT]: ErrorCode.COMMON_CONFLICT,
      [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCode.COMMON_INTERNAL_ERROR,
      [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.COMMON_SERVICE_UNAVAILABLE,
    };

    const errorCode = mapping[status];
    if (!errorCode) {
      this.logger.warn(
        `Unmapped HttpStatus: ${status}, falling back to COMMON_INTERNAL_ERROR`,
      );
      return ErrorCode.COMMON_INTERNAL_ERROR;
    }
    return errorCode;
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
