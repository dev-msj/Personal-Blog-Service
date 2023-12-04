import { registerAs } from '@nestjs/config';

export default registerAs('config', () => ({
  pkSecretKey: process.env.PK_SECRET_KEY,
  jwtSecretKey: process.env.JWT_SECRET_KEY,
  jwtIssuer: process.env.JWT_ISSUER,
  accessTokenExpireTime: process.env.JWT_ACCESSTOKEN_EXPIRE_TIME,
  refreshTokenExpireTime: process.env.JWT_REFRESHTOKEN_EXPIRE_TIME,
  refreshTokenReissueTime: process.env.JWT_REFRESHTOKEN_REISSUE_TIME,
}));
