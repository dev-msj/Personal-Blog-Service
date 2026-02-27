import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '../constant/error-code.enum';
import { BaseException } from '../exception/base.exception';
import { JwtService } from '../user/service/jwt.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get<boolean>('public', context.getClass());
    if (isPublic) {
      return true;
    }

    const request: Request = context.switchToHttp().getRequest();
    if (!request.headers.authorization) {
      this.logger.warn(
        `Authorization header is a non-existent request. - [${JSON.stringify(
          { method: request.method, url: request.url, ...request.headers },
          null,
          2,
        )}]`,
      );

      throw new BaseException(ErrorCode.AUTH_UNAUTHORIZED, 'Unauthorized');
    }

    const accessToken = request.headers.authorization.split('Bearer ')[1];
    const refreshToken = request.cookies.refreshToken;
    const verifyResult = await this.jwtService.verifyAccessToken(accessToken);

    if (verifyResult instanceof Error) {
      throw new BaseException(ErrorCode.AUTH_UNAUTHORIZED, 'Unauthorized');
    }

    const userSessionEntity =
      await this.jwtService.verifyRefreshToken(refreshToken);

    if (userSessionEntity instanceof Error) {
      throw new BaseException(ErrorCode.AUTH_UNAUTHORIZED, 'Unauthorized');
    }

    const roles = this.reflector.getAllAndMerge<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // 토큰이 검증된 유저의 Role을 확인하여 헤더에 uid를 등록한다.
    if (roles?.includes(userSessionEntity.userRole) ?? true) {
      request.headers['authenticatedUser'] = userSessionEntity.uid;

      return true;
    }

    this.logger.warn(
      `Do not have role to this path.. - [${JSON.stringify(
        {
          method: request.method,
          url: request.url,
          role: roles,
          user: userSessionEntity.uid,
          userRole: userSessionEntity.userRole,
        },
        null,
        2,
      )}]`,
    );

    return false;
  }
}
