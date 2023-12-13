import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class PostPageDto {
  @IsString()
  @IsNotEmpty()
  readonly postUid: string;

  @IsNumber()
  @IsNotEmpty()
  readonly page: number;

  constructor(postUid: string, page: number) {
    this.postUid = postUid;
    this.page = page;
  }
}
