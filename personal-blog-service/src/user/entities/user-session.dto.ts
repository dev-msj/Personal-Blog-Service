import { UserRole } from '../../constant/user-role.enum';

export class UserSessionEntity {
  readonly uid: string;
  readonly refreshToken: string;
  readonly userRole: UserRole;

  constructor(uid: string, refreshToken: string, userRole: UserRole) {
    this.uid = uid;
    this.refreshToken = refreshToken;
    this.userRole = userRole;
  }
}
