import { UserRole } from '../../constant/user-role.enum';

export class UserSessionDto {
  readonly uid: string;
  readonly refreshToken: string;
  readonly userRole: UserRole;

  constructor(uid, refreshToken, userRole) {
    this.uid = uid;
    this.refreshToken = refreshToken;
    this.userRole = userRole;
  }
}
