import { PostDto } from './post.dto';
import { PickType } from '@nestjs/mapped-types';

export class CreatePostDto extends PickType(PostDto, ['title', 'contents']) {}
