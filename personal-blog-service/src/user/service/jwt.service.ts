import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigType } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import authConfig from '../../config/authConfig';
import { UserRole } from '../../constant/user-role.enum';
import { CryptoUtils } from '../../utils/crypto.utils';
import { JwtDto } from '../dto/jwt.dto';
import { UserSessionEntity } from '../entities/user-session.entity';
import { UserAuthRepository } from '../repository/user-auth.repository';

@Injectable()
export class JwtService {
  private static ACCESS_TOKEN = 'AccessToken';
  private static REFRESH_TOKEN = 'RefreshToken';

  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    private readonly userAuthRepository: UserAuthRepository,
  ) {}

  async create(uid: string, userRole: UserRole): Promise<JwtDto> {
    const accessToken = this.generateToken(uid, JwtService.ACCESS_TOKEN);
    const refreshToken = this.generateToken(uid, JwtService.REFRESH_TOKEN);

    await this.userAuthRepository.updateUserAuthByUserSessionEntity(
      new UserSessionEntity(uid, refreshToken, userRole),
    );

    return new JwtDto(accessToken, refreshToken);
  }

  async verifyAccessToken(accessToken: string): Promise<void | Error> {
    try {
      const decodedJwt = this.decodeToken(accessToken);

      await this.userAuthRepository.getUserSessionEntityByUid(
        CryptoUtils.decryptPrimaryKey(
          decodedJwt['uid'],
          this.config.pkSecretKey,
        ),
      );
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) {
        this.logger.warn(`The access token has expired. - [${accessToken}]`);
      } else {
        this.logger.error(JSON.stringify(e, null, 2));
      }

      return e;
    }
  }

  async verifyRefreshToken(
    refreshToken: string,
  ): Promise<UserSessionEntity | Error> {
    try {
      const decodedJwt = this.decodeToken(refreshToken);

      const userSessionEntity =
        await this.userAuthRepository.getUserSessionEntityByUid(
          CryptoUtils.decryptPrimaryKey(
            decodedJwt['uid'],
            this.config.pkSecretKey,
          ),
        );

      if (refreshToken !== userSessionEntity.refreshToken) {
        this.logger.error(`Refresh Token does not match! - [${refreshToken}]`);

        return new UnauthorizedException('Refresh Token does not match!');
      }

      return userSessionEntity;
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) {
        this.logger.warn(`The refresh token has expired. - [${refreshToken}]`);
      } else {
        this.logger.error(JSON.stringify(e, null, 2));
      }

      return e;
    }
  }

  async reissueJwtByUserSessionEntity(
    userSessionEntity: UserSessionEntity,
  ): Promise<JwtDto> {
    const decodedJwt = this.decodeToken(userSessionEntity.refreshToken);
    const expiresAt = decodedJwt.exp * 1000;

    if (this.willExpire(expiresAt)) {
      this.logger.info(`JWT has been reissued. - [${userSessionEntity.uid}]`);

      return await this.create(
        userSessionEntity.uid,
        userSessionEntity.userRole,
      );
    }

    this.logger.info(
      `Access Token has been reissued. - [${userSessionEntity.uid}]`,
    );

    return new JwtDto(
      this.generateToken(userSessionEntity.uid, JwtService.ACCESS_TOKEN),
      userSessionEntity.refreshToken,
    );
  }

  private generateToken(uid: string, tokenType: string): string {
    uid = CryptoUtils.encryptPrimaryKey(uid, this.config.pkSecretKey);
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

  private decodeToken(token: string): jwt.JwtPayload {
    return jwt.verify(token, this.config.jwtSecretKey) as jwt.JwtPayload;
  }

  private willExpire(expiresAt: number): boolean {
    return (
      expiresAt - new Date().getTime() <
      Number(this.config.refreshTokenReissueTime)
    );
  }
}
