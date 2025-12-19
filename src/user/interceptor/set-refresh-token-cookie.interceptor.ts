import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { ConfigType } from '@nestjs/config';
import { JwtDto } from '../dto/jwt.dto';
import authConfig from '../../config/authConfig';

@Injectable()
export class SetRefreshTokenCookieInterceptor implements NestInterceptor {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap((data) => {
        // 응답이 JwtDto인 경우에만 쿠키 설정
        if (data instanceof JwtDto && data.refreshToken) {
          const response = context.switchToHttp().getResponse<Response>();

          response.cookie('refreshToken', data.refreshToken, {
            httpOnly: true,
            secure: this.config.cookieSecure,
            sameSite: this.config.cookieSameSite,
            maxAge: this.config.cookieMaxAge,
          });
        }
      }),
    );
  }
}
