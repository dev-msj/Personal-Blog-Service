import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { PostService } from '../service/post.serivce';
import { PostDto } from '../dto/post.dto';
import { PostLikeDto } from '../dto/post-like.dto';
import { PostLikeService } from '../service/post-like.serivce';
import { PaginationDto } from '../dto/pagination.dto';
import { SuccessResponse } from '../../response/success-response.dto';
import { PostPageRequestDto } from '../dto/post-page-request.dto';
import { Roles } from '../../decorator/roles.decorator';
import { UserRole } from '../../constant/user-role.enum';
import { DecryptionPrimaryKeyPipe } from '../../pipe/decryption-primary-key.pipe';
import { AuthenticatedUserValidation } from '../../decorator/authenticated-user-validation.decorator';

@Roles(UserRole.USER)
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
    @Param(DecryptionPrimaryKeyPipe)
    postPageRequestDto: PostPageRequestDto,
  ): Promise<PaginationDto<PostDto>> {
    return await this.postService.getPostPageListByPostPageRequestDto(
      postPageRequestDto,
    );
  }

  @Get('users/:postUid/:page')
  async getPostPageListByPostPageRequestDto(
    @Param(DecryptionPrimaryKeyPipe)
    postPageRequestDto: PostPageRequestDto,
  ): Promise<PaginationDto<PostDto>> {
    return await this.postService.getPostPageListByPostPageRequestDto(
      postPageRequestDto,
    );
  }

  @Post('likes')
  async addPostLikeUser(
    @AuthenticatedUserValidation() authUid: string,
    @Body('postId') postId: number,
  ): Promise<SuccessResponse> {
    await this.postLikeService.addPostLikeUser(
      new PostLikeDto(postId, authUid),
    );

    return new SuccessResponse();
  }

  @Delete('likes')
  async deletePostLikeUser(
    @AuthenticatedUserValidation() authUid: string,
    @Body('postId') postId: number,
  ): Promise<SuccessResponse> {
    await this.postLikeService.removePostLikeUser(
      new PostLikeDto(postId, authUid),
    );

    return new SuccessResponse();
  }
}
