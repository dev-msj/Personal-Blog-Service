import { IsDate, IsNumber, IsString } from 'class-validator';
import { PostLikeDto } from './post-like.dto';

export class PostDto {
  @IsString()
  readonly postUid: string;

  @IsNumber()
  readonly postId: number;

  @IsString()
  readonly title: string;

  @IsDate()
  readonly wrtieDatetime: Date;

  @IsString()
  readonly contents: string;

  @IsNumber()
  readonly hits: number;

  readonly postLikeDtos: PostLikeDto[];
}
