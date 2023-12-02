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
import { PostLikeService } from '../service/post-like.serivce';
import { PaginationDto } from '../dto/pagination.dto';
import { SuccessResponse } from '../../response/success-response.dto';
import { PostLikeRequestDto } from '../dto/post-like-request.dto';

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
    @Body() postLikeRequestDto: PostLikeRequestDto,
  ): Promise<SuccessResponse> {
    await this.postLikeService.addPostLikeUser(
      new PostLikeDto(
        postLikeRequestDto.postUid,
        postLikeRequestDto.postId,
        authUid,
      ),
    );

    return new SuccessResponse();
  }

  @Delete('likes')
  async deletePostLikeUser(
    @Headers('uid') authUid: string,
    @Body() postLikeRequestDto: PostLikeRequestDto,
  ): Promise<SuccessResponse> {
    await this.postLikeService.removePostLikeUser(
      new PostLikeDto(
        postLikeRequestDto.postUid,
        postLikeRequestDto.postId,
        authUid,
      ),
    );

    return new SuccessResponse();
  }
}
