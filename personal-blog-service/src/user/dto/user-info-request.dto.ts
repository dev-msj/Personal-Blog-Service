import { IsNotEmpty, IsString } from 'class-validator';

export class UserInfoRequestDto {
  @IsString()
  @IsNotEmpty()
  readonly nickname: string;

  @IsString()
  @IsNotEmpty()
  readonly introduce: string;

  constructor(nickname: string, introduce: string) {
    this.nickname = nickname;
    this.introduce = introduce;
  }
}
