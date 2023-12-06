import { IsString } from 'class-validator';

export class UserAuthRequestDto {
  @IsString()
  readonly uid: string;

  @IsString()
  readonly password: string;
}
