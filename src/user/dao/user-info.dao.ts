import { UserInfoInterface } from '../dto/interface/user-info.interface';
import { UserInfoDto } from '../dto/user-info.dto';
import { UserInfoEntity } from '../entities/user-info.entity';

export class UserInfoDao {
  private uid: string;
  private nickname: string;
  private introduce: string;

  static from(userInfoInterace: UserInfoInterface): UserInfoDao {
    const userInfoDao = new UserInfoDao();
    userInfoDao.uid = userInfoInterace.uid;
    userInfoDao.nickname = userInfoInterace.nickname;
    userInfoDao.introduce = userInfoInterace.introduce;

    return userInfoDao;
  }

  toUserInfoDto(): UserInfoDto {
    return new UserInfoDto(this.uid, this.nickname, this.introduce);
  }

  toUserInfoEntity(): UserInfoEntity {
    return new UserInfoEntity(this.uid, this.nickname, this.introduce);
  }
}
