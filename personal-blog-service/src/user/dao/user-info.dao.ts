import { UserInfoDto } from '../dto/user-info.dto';
import { UserInfoEntity } from '../entities/user-info.entity';

export class UserInfoDao {
  private uid: string;
  private nickname: string;
  private introduce: string;

  static fromUserInfoEntity(userInfoEntity: UserInfoEntity): UserInfoDao {
    const userInfoDao = new UserInfoDao();
    userInfoDao.uid = userInfoEntity.uid;
    userInfoDao.nickname = userInfoEntity.nickname;
    userInfoDao.introduce = userInfoEntity.introduce;

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
