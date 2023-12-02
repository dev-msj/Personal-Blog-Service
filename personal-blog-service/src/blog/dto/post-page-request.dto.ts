import { IsNumber, IsString } from 'class-validator';

export class PostPageRequestDto {
  @IsString()
  readonly postUid: string;

  @IsNumber()
  readonly page: number;

  constructor(postUid: string, page: number) {
    this.postUid = postUid;
    this.page = page;
  }
}
