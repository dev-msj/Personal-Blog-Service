import { IsString } from 'class-validator';

export class UserInfoDto {
  @IsString()
  readonly uid: string;

  @IsString()
  readonly nickname: string;

  @IsString()
  readonly introduce: string;
}
