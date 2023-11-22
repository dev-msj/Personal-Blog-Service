import { Controller, Get, Param } from '@nestjs/common';
import { PostService } from '../service/post.serivce';
import { PostDto } from '../dto/post.dto';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  async getDefaultPostDtoList(): Promise<PostDto[]> {
    return this.postService.getPostDtoList();
  }

  @Get(':postId')
  async getPostDtoList(@Param('postId') postId: number): Promise<PostDto[]> {
    return this.postService.getPostDtoList(postId);
  }
}
