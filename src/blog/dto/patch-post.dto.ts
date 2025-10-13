import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { PostDto } from './post.dto';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PatchPostDto extends IntersectionType(
  PickType(PostDto, ['postId']),
  PartialType(PickType(PostDto, ['title', 'contents'])),
) {
  @IsString()
  @IsNotEmpty()
  readonly postId: string;

  @IsString()
  @IsOptional()
  readonly title?: string;

  @IsString()
  @IsOptional()
  readonly contents?: string;
}
