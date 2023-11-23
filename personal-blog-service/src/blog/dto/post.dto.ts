import { IsDate, IsNumber, IsString } from 'class-validator';

export class PostDto {
  @IsString()
  readonly postUid: string;

  @IsString()
  readonly postId: string;

  @IsString()
  readonly title: string;

  @IsDate()
  readonly wrtieDatetime: Date;

  @IsString()
  readonly contents: string;

  @IsNumber()
  readonly hits: number;

  readonly postLikeUidList: string[];
}
