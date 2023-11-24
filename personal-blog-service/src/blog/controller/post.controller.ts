import { Controller, Get, Headers, Param } from '@nestjs/common';
import { PostService } from '../service/post.serivce';
import { PostDto } from '../dto/post.dto';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  async getDefaultPostDtoList(
    @Headers('uid') authUid: string,
  ): Promise<PostDto[]> {
    return await this.postService.getPostDtoList(authUid);
  }

  @Get(':postId')
  async getPostDtoList(
    @Headers('uid') authUid: string,
    @Param('postId') postId: number,
  ): Promise<PostDto[]> {
    return await this.postService.getPostDtoList(authUid, postId);
  }
}
