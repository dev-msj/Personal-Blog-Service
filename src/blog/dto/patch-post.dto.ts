import { PartialType, PickType } from '@nestjs/swagger';
import { PostDto } from './post.dto';
import { IsOptional, IsString } from 'class-validator';

export class PatchPostDto extends PartialType(
  PickType(PostDto, ['title', 'contents']),
) {
  @IsString()
  @IsOptional()
  readonly title?: string;

  @IsString()
  @IsOptional()
  readonly contents?: string;
}
