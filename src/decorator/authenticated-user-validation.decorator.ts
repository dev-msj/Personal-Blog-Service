import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { ErrorCode } from '../constant/error-code.enum';
import { BaseException } from '../exception/base.exception';

export const AuthenticatedUserValidation = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const authenticatedUser = request.headers.authenticatedUser;

    if (!authenticatedUser) {
      throw new BaseException(
        ErrorCode.AUTH_UNAUTHORIZED,
        'AuthenticatedUid does not exists.',
      );
    }

    return authenticatedUser;
  },
);
