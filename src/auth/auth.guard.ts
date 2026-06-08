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
import { AuthUnauthorizedException } from '../exception/auth';
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
    const request: Request = context.switchToHttp().getRequest();

    // 클라이언트가 위조한 authenticatedUser 헤더를 제거한다. 이 값은 본 Guard가
    // 토큰 검증 후 주입하는 신뢰값이며, CustomThrottlerGuard.getTracker와
    // @AuthenticatedUserValidation이 신뢰한다. @Public 경로에서는 아래 isPublic
    // 분기로 즉시 통과하므로, strip하지 않으면 외부 입력 헤더가 그대로 흘러
    // rate-limit 트래커 위조(IP 제한 우회) 및 신원 위조가 가능하다.
    delete request.headers['authenticatedUser'];

    const isPublic = this.reflector.get<boolean>('public', context.getClass());
    if (isPublic) {
      return true;
    }

    if (!request.headers.authorization) {
      this.logger.warn(
        `Authorization header is a non-existent request. - [${JSON.stringify(
          { method: request.method, url: request.url, ...request.headers },
          null,
          2,
        )}]`,
      );

      throw new AuthUnauthorizedException();
    }

    const accessToken = request.headers.authorization.split('Bearer ')[1];
    const refreshToken = request.cookies.refreshToken;
    const verifyResult = await this.jwtService.verifyAccessToken(accessToken);

    if (verifyResult instanceof Error) {
      throw new AuthUnauthorizedException();
    }

    const userSessionEntity =
      await this.jwtService.verifyRefreshToken(refreshToken);

    if (userSessionEntity instanceof Error) {
      throw new AuthUnauthorizedException();
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
