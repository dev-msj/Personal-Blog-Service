import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { FailureResponse } from '../response/failure-response.dto';
import { TokenReissuedException } from '../exception/token-reissued.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let response: string | object;

    // reissue된 토큰을 보내준다.
    if (exception instanceof TokenReissuedException) {
      res.status(HttpStatus.OK).json(exception);
      return;
    }

    /**
     * exception이 HttpException이 아닐 경우에는
     * 모두 InternalServerErrorException으로 변환해줘야 한다.
     * 하지만 Exception 변환을 먼저 해버리면 기존 에러 정보가 바껴버리므로,
     * 먼저 log를 찍고 Exception 변환을 한다.
     */
    if (!(exception instanceof HttpException)) {
      this.writeLog(
        req.url,
        {
          error: exception.constructor.name,
          message: exception.message,
          otherInfo: JSON.stringify(exception),
        },
        exception.stack,
      );

      exception = this.parseToInternalServerErrorException(exception);
      response = (exception as HttpException).getResponse();
    } else {
      response = (exception as HttpException).getResponse();

      this.writeLog(req.url, response, exception.stack);
    }

    res
      .status(HttpStatus.OK)
      .json(
        new FailureResponse(
          (exception as HttpException).getStatus(),
          this.getMessage(response),
        ),
      );
  }

  private writeLog(url: string, data: string | object, stack: string) {
    this.logger.error(
      JSON.stringify(
        {
          url: url,
          response: data,
          stack: stack.split('\n'),
        },
        null,
        2,
      ),
    );
  }

  private parseToInternalServerErrorException(
    exception: Error,
  ): InternalServerErrorException {
    return new InternalServerErrorException('Internal Server Error!', {
      cause: exception.stack,
      description: exception.message,
    });
  }

  private getMessage(response: string | object): string {
    return typeof response === 'string' ? response : response['message'];
  }
}
