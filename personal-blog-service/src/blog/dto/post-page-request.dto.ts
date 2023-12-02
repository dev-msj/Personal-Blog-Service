import { IsNumber, IsString } from 'class-validator';

export class PostPageRequestDto {
  @IsString()
  readonly postUid: string;

  @IsNumber()
  readonly page: number;
}
