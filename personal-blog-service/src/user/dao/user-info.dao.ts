import { UserInfoInterface } from '../dto/interface/user-info.interface';
import { UserInfoDto } from '../dto/user-info.dto';

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
    return {
      uid: this.uid,
      nickname: this.nickname,
      introduce: this.introduce,
    } as UserInfoDto;
  }
}
