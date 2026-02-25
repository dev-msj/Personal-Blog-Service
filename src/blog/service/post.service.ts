import { Injectable } from '@nestjs/common';
import { PostLikeService } from './post-like.service';
import { PostRepository } from '../repository/post.repository';
import { PostDto } from '../dto/post.dto';
import { PostPageDto } from '../dto/post-page.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { PostDao } from '../dao/post.dao';
import { PostEntity } from '../entities/post.entity';
import { PaginationUtils } from '../../utils/pagination.utils';
import { CreatePostDto } from '../dto/create-post.dto';
import { PatchPostDto } from '../dto/patch-post.dto';

@Injectable()
export class PostService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly postLikeService: PostLikeService,
  ) {}

  async createPost(
    authUid: string,
    createPostDto: CreatePostDto,
  ): Promise<void> {
    await this.postRepository.createPost(authUid, createPostDto);
  }

  async getPostPageListByPage(page: number): Promise<PaginationDto<PostDto>> {
    const [postEntityList, total] =
      await this.postRepository.findPostEntityListAndCountByPage(page);

    const postDaoList = await this.toPostDaoList(postEntityList);

    return PaginationUtils.toPaginationDto<PostDto>(
      postDaoList.map((postDao) => postDao.toPostDto()),
      total,
      page,
    );
  }

  async getPostPageListByPostUid(
    postUid: string,
    page: number,
  ): Promise<PaginationDto<PostDto>> {
    const [postEntityList, total] =
      await this.postRepository.findPostEntityListAndCountByPostPageDto(
        new PostPageDto(postUid, page),
      );

    const postDaoList = await this.toPostDaoList(postEntityList);

    return PaginationUtils.toPaginationDto<PostDto>(
      postDaoList.map((postDao) => postDao.toPostDto()),
      total,
      page,
    );
  }

  async getPostByPostId(postId: number): Promise<PostDto> {
    const postEntity = await this.postRepository.findPostEntityByPostId(postId);
    const postDao = PostDao.from({ ...postEntity });
    const postLikeMap = await this.postLikeService.getPostLikeMapByPostIds([
      postDao.getPostId,
    ]);
    postDao.setPostLikeNicknameList = postLikeMap.get(postDao.getPostId) || [];

    return postDao.toPostDto();
  }

  async updatePost(
    authUid: string,
    postId: number,
    patchPostDto: PatchPostDto,
  ): Promise<void> {
    await this.postRepository.updatePost(authUid, postId, patchPostDto);
  }

  async deletePost(authUid: string, postId: number): Promise<void> {
    await this.postRepository.deletePost(authUid, postId);
  }

  private async toPostDaoList(
    postEntityList: PostEntity[],
  ): Promise<PostDao[]> {
    const postDaoList = postEntityList.map((postEntity) =>
      PostDao.from({ ...postEntity }),
    );

    // N+1 쿼리 최적화: 모든 postId의 좋아요 목록을 한 번에 조회
    const postIds = postDaoList.map((postDao) => postDao.getPostId);
    const postLikeMap =
      await this.postLikeService.getPostLikeMapByPostIds(postIds);

    for (const postDao of postDaoList) {
      postDao.setPostLikeNicknameList =
        postLikeMap.get(postDao.getPostId) || [];
    }

    return postDaoList;
  }
}
