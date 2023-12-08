import { IsNotEmpty, IsString } from 'class-validator';

export class UserInfoDto {
  @IsString()
  @IsNotEmpty()
  readonly uid: string;

  @IsString()
  @IsNotEmpty()
  readonly nickname: string;

  @IsString()
  @IsNotEmpty()
  readonly introduce: string;

  constructor(uid: string, nickname: string, introduce: string) {
    this.uid = uid;
    this.nickname = nickname;
    this.introduce = introduce;
  }
}
