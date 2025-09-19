import { UserRole } from '../../../constant/user-role.enum';

export interface UserAuthInterface {
  uid: string;
  password: string;
  salt: string;
  socialYN: string;
  refreshToken: string;
  userRole: UserRole;
}
