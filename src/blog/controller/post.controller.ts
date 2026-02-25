import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PostService } from '../service/post.service';
import { SuccessResponse } from '../../response/success-response.dto';
import { Roles } from '../../decorator/roles.decorator';
import { UserRole } from '../../constant/user-role.enum';
import { AuthenticatedUserValidation } from '../../decorator/authenticated-user-validation.decorator';
import { successResponseOptions } from '../../response/swagger/success-response-options';
import { CreatePostDto } from '../dto/create-post.dto';
import { PatchPostDto } from '../dto/patch-post.dto';
import { PostDto } from '../dto/post.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { PageQueryDto } from '../dto/page-query.dto';
import { ApiOkResponsePaginationDto } from '../../decorator/api-ok-response-pagination-dto.decorator';
import { DecryptPrimaryKeyPipe } from '../../pipe/decrypt-primary-key.pipe';
import { EncryptPrimaryKeyInterceptor } from '../../interceptor/encrypt-primary-key.interceptor';

@Roles(UserRole.USER)
@Controller('posts')
@ApiTags('posts')
@ApiBearerAuth('accessToken')
@ApiCookieAuth('refreshToken')
@UseInterceptors(EncryptPrimaryKeyInterceptor)
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Get()
  @ApiOperation({
    description:
      '모든 유저의 블로그에서 최신 글 20개를 가져온다. page 쿼리로 페이지 지정 가능.',
  })
  @ApiOkResponsePaginationDto('블로그 리스트를 담은 페이지', PostDto)
  @ApiNotFoundResponse({
    description: 'User does not exist! - [uid]',
  })
  async getAllPosts(
    @Query() query: PageQueryDto,
  ): Promise<PaginationDto<PostDto>> {
    return await this.postService.getPostPageListByPage(query.page);
  }

  @Get('users/:postUid')
  @ApiOperation({
    description:
      '특정 유저의 블로그에서 최신 글 20개를 가져온다. page 쿼리로 페이지 지정 가능.',
  })
  @ApiOkResponsePaginationDto('블로그 리스트를 담은 페이지', PostDto)
  @ApiNotFoundResponse({
    description: 'User does not exist! - [uid]',
  })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async getUserPosts(
    @Param('postUid', DecryptPrimaryKeyPipe) postUid: string,
    @Query() query: PageQueryDto,
  ): Promise<PaginationDto<PostDto>> {
    return await this.postService.getPostPageListByPostUid(postUid, query.page);
  }

  @Get(':postId')
  @ApiOperation({ description: '블로그 글 하나를 가져온다.' })
  @ApiResponse({
    status: 200,
    description: '블로그 글 하나를 담은 응답',
    type: PostDto,
  })
  @ApiNotFoundResponse({ description: 'User does not exist! - [uid]' })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async getPost(
    @Param('postId', DecryptPrimaryKeyPipe, ParseIntPipe) postId: number,
  ): Promise<PostDto> {
    return await this.postService.getPostByPostId(postId);
  }

  @Post()
  @ApiOperation({ description: '새로운 글을 생성한다.' })
  @ApiCreatedResponse(successResponseOptions)
  @ApiBadRequestResponse({ description: 'Request body error' })
  async createPost(
    @AuthenticatedUserValidation() authUid: string,
    @Body() createPostDto: CreatePostDto,
  ): Promise<SuccessResponse> {
    await this.postService.createPost(authUid, createPostDto);

    return new SuccessResponse();
  }

  @Patch(':postId')
  @ApiOperation({ description: '블로그 글을 수정한다.' })
  @ApiOkResponse(successResponseOptions)
  @ApiNotFoundResponse({
    description: 'User does not exist! - [uid]',
  })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async patchPost(
    @AuthenticatedUserValidation() authUid: string,
    @Param('postId', DecryptPrimaryKeyPipe, ParseIntPipe) postId: number,
    @Body() patchPostDto: PatchPostDto,
  ): Promise<SuccessResponse> {
    await this.postService.updatePost(authUid, postId, patchPostDto);

    return new SuccessResponse();
  }

  @Delete(':postId')
  @ApiOperation({ description: '블로그 글을 삭제한다.' })
  @ApiOkResponse(successResponseOptions)
  @ApiNotFoundResponse({
    description: 'User does not exist! - [uid]',
  })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async deletePost(
    @AuthenticatedUserValidation() authUid: string,
    @Param('postId', DecryptPrimaryKeyPipe, ParseIntPipe) postId: number,
  ): Promise<SuccessResponse> {
    await this.postService.deletePost(authUid, postId);

    return new SuccessResponse();
  }
}
