import { Controller, Delete, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PostLikeDto } from '../dto/post-like.dto';
import { PostLikeService } from '../service/post-like.service';
import { SuccessResponse } from '../../response/success-response.dto';
import { Roles } from '../../decorator/roles.decorator';
import { UserRole } from '../../constant/user-role.enum';
import { AuthenticatedUserValidation } from '../../decorator/authenticated-user-validation.decorator';
import { successResponseOptions } from '../../response/swagger/success-response-options';

@Roles(UserRole.USER)
@Controller('posts/:encryptedPostId/likes')
@ApiTags('posts/likes')
@ApiBearerAuth('accessToken')
@ApiCookieAuth('refreshToken')
export class PostLikeController {
  constructor(private readonly postLikeService: PostLikeService) {}

  @Post()
  @ApiOperation({
    description: '특정 유저의 블로그에 좋아요를 누른 유저를 추가한다.',
  })
  @ApiCreatedResponse(successResponseOptions)
  @ApiConflictResponse({
    description: 'PostId is already exist!',
  })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async addPostLikeUser(
    @AuthenticatedUserValidation() authUid: string,
    @Param('encryptedPostId') encryptedPostId: string,
  ): Promise<SuccessResponse> {
    await this.postLikeService.addPostLikeUser(
      new PostLikeDto(encryptedPostId, authUid),
    );

    return new SuccessResponse();
  }

  @Delete()
  @ApiOperation({
    description: '특정 유저의 블로그에 좋아요를 누른 유저를 삭제한다.',
  })
  @ApiOkResponse(successResponseOptions)
  @ApiConflictResponse({
    description: 'PostId is does not exist!',
  })
  @ApiBadRequestResponse({ description: 'Request body error' })
  async deletePostLikeUser(
    @AuthenticatedUserValidation() authUid: string,
    @Param('encryptedPostId') encryptedPostId: string,
  ): Promise<SuccessResponse> {
    await this.postLikeService.removePostLikeUser(
      new PostLikeDto(encryptedPostId, authUid),
    );

    return new SuccessResponse();
  }
}
