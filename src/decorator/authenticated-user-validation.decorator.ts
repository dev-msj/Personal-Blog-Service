import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

export const AuthenticatedUserValidation = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const authenticatedUser = request.headers.authenticatedUser;

    if (!authenticatedUser) {
      throw new UnauthorizedException('AuthenticatedUid does not exists.');
    }

    return authenticatedUser;
  },
);
