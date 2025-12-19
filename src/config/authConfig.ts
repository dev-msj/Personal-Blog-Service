import { registerAs } from '@nestjs/config';
import type { StringValue } from 'ms';
import * as ms from 'ms';

export default registerAs('config', () => ({
  pkSecretKey: process.env.PK_SECRET_KEY,
  jwtSecretKey: process.env.JWT_SECRET_KEY,
  jwtIssuer: process.env.JWT_ISSUER,
  accessTokenExpireTime:
    (process.env.JWT_ACCESSTOKEN_EXPIRE_TIME as StringValue | number) || '1h',
  refreshTokenExpireTime:
    (process.env.JWT_REFRESHTOKEN_EXPIRE_TIME as StringValue | number) || '30d',
  refreshTokenReissueTime:
    (process.env.JWT_REFRESHTOKEN_REISSUE_TIME as StringValue | number) || '3d',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  // Cookie settings
  cookieMaxAge: process.env.COOKIE_MAX_AGE
    ? ms(process.env.COOKIE_MAX_AGE as StringValue)
    : 30 * 24 * 60 * 60 * 1000, // 기본값: 30일
  cookieSecure: process.env.NODE_ENV === 'production',
  cookieSameSite:
    (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'strict',
}));
