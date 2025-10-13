import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PostService } from '../service/post.service';
import { PostDto } from '../dto/post.dto';
import { PostLikeDto } from '../dto/post-like.dto';
import { PostLikeService } from '../service/post-like.service';
import { PaginationDto } from '../dto/pagination.dto';
import { SuccessResponse } from '../../response/success-response.dto';
import { PostPageRequestDto } from '../dto/post-page-request.dto';
import { Roles } from '../../decorator/roles.decorator';
import { UserRole } from '../../constant/user-role.enum';
import { AuthenticatedUserValidation } from '../../decorator/authenticated-user-validation.decorator';
import { successResponseOpions } from '../../response/swagger/success-response-options';
import { ApiOkResponsePaginationDto } from '../../decorator/api-ok-response-pagination-dto.decorator';
import { PostLikeRequestDto } from '../dto/post-like-request.dto';
import { CreatePostDto } from '../dto/create-post.dto';
import { PatchPostDto } from '../dto/patch-post.dto';

@Roles(UserRole.USER)
@Controller('posts')
@ApiTags('posts')
@ApiBearerAuth('accessToken')
@ApiCookieAuth('refreshToken')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly postLikeService: PostLikeService,
  ) {}

  @Post()
  @ApiOperation({ description: '새로운 글을 생성한다.' })
  @ApiOkResponse(successResponseOpions)
  @ApiBadRequestResponse({ description: 'Request body error' })
  async createPost(
    @AuthenticatedUserValidation() authUid: string,
    @Body() createPostDto: CreatePostDto,
  ): Promise<SuccessResponse> {
    await this.postService.createPost(authUid, createPostDto);

    return new SuccessResponse();
  }

  @Get('all-users')
  @ApiOperation({
    description: '모든 유저의 블로그에서 최신 글 20개를 가져온다.',
  })
  @ApiOkResponsePaginationDto('블로그 리스트를 담은 첫번째 페이지', PostDto)
  @ApiNotFoundResponse({
    description: 'User does not exist! - [uid]',
  })
  async getLatestPostDtoList() {
    return await this.postService.getPostPageListByPage();
  }

  @Get('all-users/:page')
  @ApiOperation({
    description:
      '모든 유저의 블로그에서 요청된 페이지에 해당하는 글 20개를 가져온다.',
  })
  @ApiOkResponsePaginationDto('블로그 리스트를 담은 요청된 페이지', PostDto)
  @ApiNotFoundResponse({
    description: 'User does not exist! - [uid]',
  })
  async getPostDtoListByPage(@Param('page') page: number) {
    return await this.postService.getPostPageListByPage(page);
  }

  @Get('users/:postUid')
  @ApiOperation({
    description: '특정 유저의 블로그에서 최신 글 20개를 가져온다.',
  })
  @ApiOkResponsePaginationDto('블로그 리스트를 담은 첫번째 페이지', PostDto)
  @ApiNotFoundResponse({
    description: 'User does not exist! - [uid]',
  })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async getLatestPostPageListByPostPageRequestDto(
    @Param()
    postPageRequestDto: PostPageRequestDto,
  ): Promise<PaginationDto<PostDto>> {
    return await this.postService.getPostPageListByPostPageRequestDto(
      postPageRequestDto,
    );
  }

  @Get('users/:postUid/:page')
  @ApiOperation({
    description:
      '특정 유저의 블로그에서 요청된 페이지에 해당하는 글 20개를 가져온다.',
  })
  @ApiOkResponsePaginationDto('블로그 리스트를 담은 요청된 페이지', PostDto)
  @ApiNotFoundResponse({
    description: 'User does not exist! - [uid]',
  })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async getPostPageListByPostPageRequestDto(
    @Param()
    postPageRequestDto: PostPageRequestDto,
  ): Promise<PaginationDto<PostDto>> {
    return await this.postService.getPostPageListByPostPageRequestDto(
      postPageRequestDto,
    );
  }

  @Patch(':encryptedPostId')
  @ApiOperation({ description: '블로그 글을 수정한다.' })
  @ApiOkResponse(successResponseOpions)
  @ApiNotFoundResponse({
    description: 'User does not exist! - [uid]',
  })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async patchPost(
    @AuthenticatedUserValidation() authUid: string,
    @Param('encryptedPostId') encryptedPostId: string,
    @Body() patchPostDto: PatchPostDto,
  ): Promise<SuccessResponse> {
    await this.postService.updatePost(authUid, encryptedPostId, patchPostDto);

    return new SuccessResponse();
  }

  @Post('likes')
  @ApiOperation({
    description: '특정 유저의 블로그에 좋아요를 누른 유저를 추가한다.',
  })
  @ApiOkResponse(successResponseOpions)
  @ApiConflictResponse({
    description: 'PostId is already exist!',
  })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async addPostLikeUser(
    @AuthenticatedUserValidation() authUid: string,
    @Body() postLikeRequestDto: PostLikeRequestDto,
  ): Promise<SuccessResponse> {
    await this.postLikeService.addPostLikeUser(
      new PostLikeDto(postLikeRequestDto.encryptedPostId, authUid),
    );

    return new SuccessResponse();
  }

  @Delete('likes')
  @ApiOperation({
    description: '특정 유저의 블로그에 좋아요를 누른 유저를 삭제한다.',
  })
  @ApiOkResponse(successResponseOpions)
  @ApiConflictResponse({
    description: 'PostId is does not exist!',
  })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async deletePostLikeUser(
    @AuthenticatedUserValidation() authUid: string,
    @Body() postLikeRequestDto: PostLikeRequestDto,
  ): Promise<SuccessResponse> {
    await this.postLikeService.removePostLikeUser(
      new PostLikeDto(postLikeRequestDto.encryptedPostId, authUid),
    );

    return new SuccessResponse();
  }
}
