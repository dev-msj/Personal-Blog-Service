import { PostLikeService } from './post-like.service';
import { Test } from '@nestjs/testing';
import { PostLikeRepository } from '../repository/post-like.repository';
import { UserInfoService } from '../../user/service/user-info.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import authConfig from '../../config/authConfig';
import { ConflictException } from '@nestjs/common';
import { PostLikeDto } from '../dto/post-like.dto';

describe('PostLikeService', () => {
  let postLikeService: PostLikeService;
  let postLikeRepository: PostLikeRepository;
  let userInfoService: UserInfoService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PostLikeService,
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
          },
        },
        {
          provide: authConfig.KEY,
          useValue: {
            pkSecretKey: 'test-key',
          },
        },
        {
          provide: PostLikeRepository,
          useValue: {
            findPostLikeEntityList: jest.fn(),
            findPostLikeEntitiesByPostIds: jest.fn(),
            isExist: jest.fn(),
            savePostLikeEntity: jest.fn(),
            removePostLikeEntity: jest.fn(),
          },
        },
        {
          provide: UserInfoService,
          useValue: {
            getUserInfoByUid: jest.fn(),
          },
        },
      ],
    }).compile();

    postLikeService = module.get(PostLikeService);
    postLikeRepository = module.get(PostLikeRepository);
    userInfoService = module.get(UserInfoService);
  });

  describe('getPostLikeMapByPostIds', () => {
    it('postId의 좋아요 닉네임 목록을 Map으로 반환', async () => {
      // Given
      const postIds = [1];
      postLikeRepository.findPostLikeEntitiesByPostIds = jest
        .fn()
        .mockResolvedValue([{ postId: 1, uid: 'user1' }]);
      userInfoService.getUserInfoByUid = jest
        .fn()
        .mockResolvedValue({ nickname: 'nick_user1' });

      // When
      const result = await postLikeService.getPostLikeMapByPostIds(postIds);

      // Then
      expect(result.get(1)).toEqual(['nick_user1']);
    });

    it('좋아요가 없는 postId는 빈 배열 반환', async () => {
      // Given
      const postIds = [1];
      postLikeRepository.findPostLikeEntitiesByPostIds = jest
        .fn()
        .mockResolvedValue([]);

      // When
      const result = await postLikeService.getPostLikeMapByPostIds(postIds);

      // Then
      expect(result.get(1)).toEqual([]);
    });

    it('빈 postIds 배열 전달 시 빈 Map 반환', async () => {
      // Given
      postLikeRepository.findPostLikeEntitiesByPostIds = jest
        .fn()
        .mockResolvedValue([]);

      // When
      const result = await postLikeService.getPostLikeMapByPostIds([]);

      // Then
      expect(result.size).toBe(0);
    });
  });

  describe('addPostLikeUser', () => {
    it('좋아요 추가 성공', async () => {
      // Given
      const postLikeDto = new PostLikeDto('encryptedPostId', 'uid');
      postLikeRepository.isExist = jest.fn().mockResolvedValue(false);
      postLikeRepository.savePostLikeEntity = jest.fn().mockResolvedValue(null);

      // When
      await postLikeService.addPostLikeUser(postLikeDto);

      // Then
      expect(postLikeRepository.savePostLikeEntity).toHaveBeenCalled();
    });

    it('이미 좋아요한 게시글에 중복 좋아요 시 ConflictException 발생', async () => {
      // Given
      const postLikeDto = new PostLikeDto('encryptedPostId', 'uid');
      postLikeRepository.isExist = jest.fn().mockResolvedValue(true);

      // When & Then
      await expect(
        postLikeService.addPostLikeUser(postLikeDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removePostLikeUser', () => {
    it('좋아요 삭제 성공', async () => {
      // Given
      const postLikeDto = new PostLikeDto('encryptedPostId', 'uid');
      postLikeRepository.isExist = jest
        .fn()
        .mockReturnValue(Promise.resolve(true));
      postLikeRepository.removePostLikeEntity = jest.fn().mockResolvedValue(null);

      // When
      await postLikeService.removePostLikeUser(postLikeDto);

      // Then
      expect(postLikeRepository.removePostLikeEntity).toHaveBeenCalled();
    });

    it('좋아요하지 않은 게시글 삭제 시 ConflictException 발생', async () => {
      // Given
      const postLikeDto = new PostLikeDto('encryptedPostId', 'uid');
      postLikeRepository.isExist = jest.fn().mockResolvedValue(false);

      // When & Then
      await expect(
        postLikeService.removePostLikeUser(postLikeDto),
      ).rejects.toThrow(ConflictException);
    });
  });
});
