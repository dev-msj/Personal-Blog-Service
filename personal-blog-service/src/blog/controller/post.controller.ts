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
import { PostLikeDto } from '../dto/post-like.dto';
import { SuccessResponse } from 'src/response/success-response.dto';
import { PostLikeService } from '../service/post-like.serivce';
import { PaginationDto } from '../dto/pagination.dto';

@Controller('posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly postLikeService: PostLikeService,
  ) {}

  @Get()
  async getDefaultPostDtoList(
    @Headers('uid') authUid: string,
  ): Promise<PaginationDto<PostDto>> {
    return await this.postService.getPostDtoList(authUid);
  }

  @Get(':page')
  async getPostDtoList(
    @Headers('uid') authUid: string,
    @Param('page') page: number,
  ): Promise<PaginationDto<PostDto>> {
    return await this.postService.getPostDtoList(authUid, page);
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
