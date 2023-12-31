import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import * as CryptoJS from 'crypto-js';
import { SHA256 } from 'crypto-js';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { UserAuthRequestDto } from '../dto/user-auth-request.dto';
import { UserAuthRepository } from '../repository/user-auth.repository';
import { UserRole } from '../../constant/user-role.enum';
import { JwtDto } from '../dto/jwt.dto';
import { UserAuthDao } from './../dao/user-auth.dao';
import { JwtService } from './jwt.service';
import authConfig from '../../config/authConfig';
import { OauthRequestDto } from '../dto/oauth-request.dto';

@Injectable()
export class UserAuthService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
    private readonly jwtService: JwtService,
    private readonly userAuthRepository: UserAuthRepository,
  ) {}

  async createNewUser(userAuthRequestDto: UserAuthRequestDto): Promise<JwtDto> {
    const isExist = await this.userAuthRepository.isExist(
      userAuthRequestDto.uid,
    );
    if (isExist) {
      throw new ConflictException(
        `User already exists. - [${userAuthRequestDto.uid}]`,
      );
    }

    const userRole = UserRole.USER;
    const salt = new Date().getTime().toString();

    await this.userAuthRepository.saveUserAuthEntity(
      UserAuthDao.from({
        uid: userAuthRequestDto.uid,
        password: this.hashingPassword(userAuthRequestDto.password, salt),
        salt: salt,
        socialYN: 'N',
        refreshToken: '',
        userRole: userRole,
      }).toUserAuthEntity(),
    );

    const jwtDto = await this.jwtService.create(
      userAuthRequestDto.uid,
      userRole,
    );

    this.logger.info(
      `A new user has been created. - [${userAuthRequestDto.uid}]`,
    );

    return jwtDto;
  }

  async login(userAuthRequestDto: UserAuthRequestDto): Promise<JwtDto> {
    const userAuthEntity = await this.userAuthRepository.getUserAuthEntity(
      userAuthRequestDto.uid,
    );

    const hashedPassword = this.hashingPassword(
      userAuthRequestDto.password,
      userAuthEntity.salt,
    );

    if (hashedPassword !== userAuthEntity.password) {
      throw new UnauthorizedException('Password does not match.');
    }

    return this.jwtService.create(userAuthEntity.uid, userAuthEntity.userRole);
  }

  async googleOauthLogin(oauthRequestDto: OauthRequestDto): Promise<JwtDto> {
    const ticket = await this.decodeCredentialToken(
      oauthRequestDto.credentialToken,
    );
    const uid = ticket.getPayload().email;
    const isExist = await this.userAuthRepository.isExist(uid);

    // 인증된 토큰이나 UserAuth가 존재하지 않으면 생성시킨다.
    if (!isExist) {
      await this.userAuthRepository.saveUserAuthEntity(
        UserAuthDao.from({
          uid: uid,
          password: '-',
          salt: '-',
          socialYN: 'Y',
          refreshToken: '',
          userRole: UserRole.USER,
        }).toUserAuthEntity(),
      );

      this.logger.info(`A new social user has been created. - [${uid}]`);
    }

    const userAuthEntity = await this.userAuthRepository.getUserAuthEntity(uid);

    return this.jwtService.create(userAuthEntity.uid, userAuthEntity.userRole);
  }

  private hashingPassword(password: string, salt: string): string {
    for (let i = 0; i < 3; i++) {
      const strectchedPassword = `${password}${salt}`;
      const hash = SHA256(strectchedPassword);
      password = hash.toString(CryptoJS.enc.Hex);
    }

    return password;
  }

  private async decodeCredentialToken(
    credentialToken: string,
  ): Promise<LoginTicket> {
    try {
      const client = new OAuth2Client(this.config.googleClientId);
      return await client.verifyIdToken({
        idToken: credentialToken,
        audience: this.config.googleClientId,
      });
    } catch (e) {
      this.logger.warn(
        `CredentialToken is not allowed. - [${credentialToken}]`,
      );

      throw new UnauthorizedException('This token is not allowed.');
    }
  }
}
