import { IsString } from 'class-validator';
import { UserRole } from '../../constant/user-role.enum';

export class UserAuthDto {
  @IsString()
  readonly uid: string;

  @IsString()
  readonly password: string;

  @IsString()
  readonly salt: string;

  @IsString()
  readonly socialYN: string;

  @IsString()
  readonly refreshToken: string;

  readonly userRole: UserRole;

  constructor(
    uid: string,
    password: string,
    salt: string,
    socialYN: string,
    refreshToken: string,
    userRole: UserRole,
  ) {
    this.uid = uid;
    this.password = password;
    this.salt = salt;
    this.socialYN = socialYN;
    this.refreshToken = refreshToken;
    this.userRole = userRole;
  }
}
