import { IsNotEmpty, IsString } from 'class-validator';
import { PostDto } from './post.dto';
import { PickType } from '@nestjs/mapped-types';

export class CreatePostDto extends PickType(PostDto, ['title', 'contents']) {
  @IsString()
  @IsNotEmpty()
  readonly title: string;

  @IsString()
  @IsNotEmpty()
  readonly contents: string;
}
