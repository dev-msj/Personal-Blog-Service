import { Inject, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigType } from '@nestjs/config';
import { JwtDto } from '../dto/jwt.dto';
import { CryptoUtils } from './../../utils/crypto.utils';
import authConfig from '../../config/authConfig';
import { UserRole } from '../../constant/user-role.enum';
import { UserAuthRepository } from '../repository/user-auth.repository';
import { UserSessionDto } from '../dto/user-session.dto';

@Injectable()
export class JwtService {
  private static ACCESS_TOKEN = 'AccessToken';
  private static REFRESH_TOKEN = 'RefreshToken';

  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
    private readonly userAuthRepository: UserAuthRepository,
  ) {}

  async create(uid: string, userRole: UserRole): Promise<JwtDto> {
    const accessToken = this.generateToken(uid, JwtService.ACCESS_TOKEN);
    const refreshToken = this.generateToken(uid, JwtService.REFRESH_TOKEN);

    await this.userAuthRepository.updateUserAuthByUserSessionDto(
      new UserSessionDto(uid, refreshToken, userRole),
    );

    return new JwtDto(accessToken, refreshToken);
  }

  private generateToken(uid: string, tokenType: string): string {
    uid = CryptoUtils.encryptPostPK(uid, this.config.pkSecretKey);
    const expiresIn =
      tokenType === JwtService.ACCESS_TOKEN
        ? this.config.accessTokenExpireTime
        : this.config.refreshTokenExpireTime;

    return jwt.sign(
      {
        uid: uid,
      },
      this.config.jwtSecretKey,
      {
        algorithm: 'HS256',
        issuer: this.config.jwtIssuer,
        subject: uid,
        expiresIn: expiresIn,
      },
    );
  }
}
