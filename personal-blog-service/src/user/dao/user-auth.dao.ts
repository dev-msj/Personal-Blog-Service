import { UserRole } from '../../constant/user-role.enum';
import { UserAuthDto } from '../dto/user-auth.dto';
import { UserAuthEntity } from '../entities/user-auth.entity';
import { UserAuthInterface } from './../dto/interface/user-auth.interface';

export class UserAuthDao {
  private uid: string;
  private password: string;
  private salt: string;
  private socialYN: string;
  private refreshToken: string;
  private userRole: UserRole;

  static from(userAuthInterface: UserAuthInterface): UserAuthDao {
    const userAuthDao = new UserAuthDao();
    userAuthDao.uid = userAuthInterface.uid;
    userAuthDao.password = userAuthInterface.password;
    userAuthDao.salt = userAuthInterface.salt;
    userAuthDao.refreshToken = userAuthInterface.refreshToken;
    userAuthDao.userRole = userAuthInterface.userRole;

    return userAuthDao;
  }

  toUserAuthEntity(): UserAuthEntity {
    return new UserAuthEntity(
      this.uid,
      this.password,
      this.salt,
      this.socialYN,
      this.refreshToken,
      this.userRole,
    );
  }

  toUserAuthDto(): UserAuthDto {
    return new UserAuthDto(
      this.uid,
      this.password,
      this.salt,
      this.socialYN,
      this.refreshToken,
      this.userRole,
    );
  }
}
