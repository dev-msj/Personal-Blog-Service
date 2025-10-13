import { PickType } from '@nestjs/swagger';
import { PostDto } from './post.dto';

export class PatchPostDto extends PickType(PostDto, [
  'postId',
  'title',
  'contents',
]) {}
