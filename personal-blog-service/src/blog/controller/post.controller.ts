import { Controller, Get } from '@nestjs/common';
import { PostService } from '../service/post.serivce';
import { PostDto } from '../dto/post.dto';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  async getPostDtoList(): Promise<PostDto[]> {
    return this.postService.getPostDtoList();
  }
}
