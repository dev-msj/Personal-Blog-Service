import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthUnauthorizedException } from '../exception/auth';

export const AuthenticatedUserValidation = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const authenticatedUser = request.headers.authenticatedUser;

    if (!authenticatedUser) {
      throw new AuthUnauthorizedException('AuthenticatedUid does not exists.');
    }

    return authenticatedUser;
  },
);
