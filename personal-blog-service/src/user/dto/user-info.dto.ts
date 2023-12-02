import { IsString } from 'class-validator';

export class UserInfoDto {
  @IsString()
  readonly uid: string;

  @IsString()
  readonly nickname: string;

  @IsString()
  readonly introduce: string;

  constructor(uid: string, nickname: string, introduce: string) {
    this.uid = uid;
    this.nickname = nickname;
    this.introduce = introduce;
  }
}
