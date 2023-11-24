import { Controller, Get, Headers, Param } from '@nestjs/common';
import { PostService } from '../service/post.serivce';
import { PostDto } from '../dto/post.dto';
import { DecryptionPipe } from 'src/pipe/decryption.pipe';

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
    @Param('postId', DecryptionPipe) postId: number,
  ): Promise<PostDto[]> {
    return await this.postService.getPostDtoList(authUid, postId);
  }
}
