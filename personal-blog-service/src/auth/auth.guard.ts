import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';
import { TokenReissuedException } from '../exception/token-reissued.exception';
import { ErrorCode } from '../constant/error-code.enum';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Reflector } from '@nestjs/core';
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
    if (!request.headers.authorization) {
      this.logger.warn(
        `Authorization header is a non-existent request. - [${JSON.stringify(
          { method: request.method, url: request.url, ...request.headers },
          null,
          2,
        )}]`,
      );

      return false;
    }

    const accessToken = request.headers.authorization.split('Bearer ')[1];
    const refreshToken = request.cookies.RefreshToken;
    const verifyResult = await this.jwtService.verifyAccessToken(accessToken);

    // access token이 expired 상태여도 refresh token으로 reissue 할 수 있도록 pass 시킨다.
    if (
      verifyResult instanceof Error &&
      !(verifyResult instanceof TokenExpiredError)
    ) {
      return false;
    }

    const userSessionDto =
      await this.jwtService.verifyRefreshToken(refreshToken);

    if (userSessionDto instanceof Error) {
      return false;
    }

    if (verifyResult instanceof TokenExpiredError) {
      const jwtDto =
        await this.jwtService.reissueJwtByUserSessionDto(userSessionDto);
      throw new TokenReissuedException(
        ErrorCode.NOT_ACCEPTABLE,
        'Token is reissued!',
        jwtDto,
      );
    }

    const roles = this.reflector.getAllAndMerge<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // 토큰이 검증된 유저의 Role을 확인하여 헤더에 uid를 등록한다.
    if (roles?.includes(userSessionDto.userRole) ?? true) {
      request.headers['authenticatedUser'] = userSessionDto.uid;

      return true;
    }

    this.logger.warn(
      `Do not have role to this path.. - [${JSON.stringify(
        {
          method: request.method,
          url: request.url,
          role: roles,
          user: userSessionDto.uid,
          userRole: userSessionDto.userRole,
        },
        null,
        2,
      )}]`,
    );

    return false;
  }
}
