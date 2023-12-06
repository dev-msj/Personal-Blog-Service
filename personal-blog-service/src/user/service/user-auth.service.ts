import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { JwtService } from '../../auth/jwt.service';
import { UserJoinRequestDto } from './../dto/user-join-request.dto';
import { UserAuthRepository } from '../repository/user-auth.repository';
import { UserRole } from '../../constant/user-role.enum';
import { JwtDto } from '../dto/jwt.dto';
import { SHA256 } from 'crypto-js';
import { UserAuthDao } from './../dao/user-auth.dao';

@Injectable()
export class UserAuthService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    private readonly jwtService: JwtService,
    private readonly userAuthRepository: UserAuthRepository,
  ) {}

  async createNewUser(userJoinRequestDto: UserJoinRequestDto): Promise<JwtDto> {
    const userRole = UserRole.USER;
    const salt = new Date().getTime().toString();

    await this.userAuthRepository.saveUserAuthEntity(
      UserAuthDao.from({
        uid: userJoinRequestDto.uid,
        password: this.hashingPassword(userJoinRequestDto.password, salt),
        salt: salt,
        socialYN: 'N',
        refreshToken: '',
        userRole: userRole,
      }).toUserAuthEntity(),
    );

    const jwtDto = await this.jwtService.create(
      userJoinRequestDto.uid,
      userRole,
    );

    this.logger.info(
      `A new user has been created. - [${userJoinRequestDto.uid}]`,
    );

    return jwtDto;
  }

  private hashingPassword(password: string, salt: string): string {
    for (let i = 0; i < 3; i++) {
      const strectchedPassword = `${password}${salt}`;
      const hash = SHA256(strectchedPassword);
      password = hash.toString(CryptoJS.enc.Hex);
    }

    return password;
  }
}
