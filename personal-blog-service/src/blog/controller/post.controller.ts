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
import { PostPageRequestDto } from '../dto/post-page-request.dto';
import { DecryptionPostPKPipe } from '../../pipe/decryptionPostPk.pipe';

@Controller('posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly postLikeService: PostLikeService,
  ) {}

  @Get('all-users')
  async getLatestPostDtoList() {
    return await this.postService.getPostPageListByPage();
  }

  @Get('all-users/:page')
  async getPostDtoListByPage(@Param('page') page: number) {
    return await this.postService.getPostPageListByPage(page);
  }

  @Get('users/:postUid')
  async getLatestPostPageListByPostPageRequestDto(
    @Param(DecryptionPostPKPipe) postPageRequestDto: PostPageRequestDto,
  ): Promise<PaginationDto<PostDto>> {
    return await this.postService.getPostPageListByPostPageRequestDto(
      postPageRequestDto,
    );
  }

  @Get('users/:postUid/:page')
  async getPostPageListByPostPageRequestDto(
    @Param(DecryptionPostPKPipe) postPageRequestDto: PostPageRequestDto,
  ): Promise<PaginationDto<PostDto>> {
    return await this.postService.getPostPageListByPostPageRequestDto(
      postPageRequestDto,
    );
  }

  @Post('likes')
  async addPostLikeUser(
    @Headers('authenticatedUser') authUid: string,
    @Body('postId') postId: number,
  ): Promise<SuccessResponse> {
    await this.postLikeService.addPostLikeUser(
      new PostLikeDto(postId, authUid),
    );

    return new SuccessResponse();
  }

  @Delete('likes')
  async deletePostLikeUser(
    @Headers('authenticatedUser') authUid: string,
    @Body('postId') postId: number,
  ): Promise<SuccessResponse> {
    await this.postLikeService.removePostLikeUser(
      new PostLikeDto(postId, authUid),
    );

    return new SuccessResponse();
  }
}
