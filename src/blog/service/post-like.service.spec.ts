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
            isExist: jest.fn(),
            savePostLikeEntity: jest.fn(),
            removePostLikeDto: jest.fn(),
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
      postLikeRepository.removePostLikeDto = jest.fn().mockResolvedValue(null);

      // When
      await postLikeService.removePostLikeUser(postLikeDto);

      // Then
      expect(postLikeRepository.removePostLikeDto).toHaveBeenCalled();
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
