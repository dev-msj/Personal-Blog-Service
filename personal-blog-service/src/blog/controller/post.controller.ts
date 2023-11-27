import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { PostService } from '../service/post.serivce';
import { PostDto } from '../dto/post.dto';
import { DecryptionPipe } from 'src/pipe/decryption.pipe';
import { PostLikeDto } from '../dto/post-like.dto';
import { SuccessResponse } from 'src/response/success-response.dto';
import { PostLikeService } from '../service/post-like.serivce';

@Controller('posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly postLikeService: PostLikeService,
  ) {}

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

  @Post('likes')
  async addPostLikeUser(
    @Headers('uid') authUid: string,
    @Body() postLikeDto: PostLikeDto,
  ): Promise<SuccessResponse> {
    await this.postLikeService.addPostLikeUser({
      ...postLikeDto,
      uid: authUid,
    } as PostLikeDto);
    return new SuccessResponse();
  }

  @Delete('likes')
  async deletePostLikeUser(
    @Headers('uid') authUid: string,
    @Body() postLikeDto: PostLikeDto,
  ): Promise<SuccessResponse> {
    await this.postLikeService.removePostLikeUser({
      ...postLikeDto,
      uid: authUid,
    } as PostLikeDto);

    return new SuccessResponse();
  }
}
