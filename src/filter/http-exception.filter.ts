import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../constant/error-code.enum';
import { AbstractExceptionFilter } from './abstract-exception.filter';
import {
  HTTP_STATUS_TO_ERROR_CODE,
  extractHttpExceptionMessage,
} from './http-status-error-code.util';

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
      extractHttpExceptionMessage(response),
    );
  }

  // 매핑 테이블은 http-status-error-code.util의 단일 소스를 참조한다
  // (IdempotencyKeyInterceptor와 공유 — 멱등성상 분기 금지). 미매핑 status만
  // 경고 후 COMMON_INTERNAL_ERROR로 폴백한다.
  private mapToErrorCode(status: number): ErrorCode {
    const errorCode = HTTP_STATUS_TO_ERROR_CODE[status];
    if (!errorCode) {
      this.logger.warn(
        `Unmapped HttpStatus: ${status}, falling back to COMMON_INTERNAL_ERROR`,
      );
      return ErrorCode.COMMON_INTERNAL_ERROR;
    }
    return errorCode;
  }
}
