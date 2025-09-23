import { PostRepository } from '../repository/post.repository';
import { PostLikeService } from './post-like.service';
import { PostService } from './post.service';
import authConfig from '../../config/authConfig';
import { Test } from '@nestjs/testing';
import { ConfigType } from '@nestjs/config';
import { CryptoUtils } from '../../utils/crypto.utils';
import { PostPageRequestDto } from '../dto/post-page-request.dto';
import { PostEntity } from '../entities/post.entity';

describe('PostService', () => {
  let postService: PostService;
  let config: ConfigType<typeof authConfig>;
  let postRepository: PostRepository;
  let postLikeService: PostLikeService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: authConfig.KEY,
          useValue: {
            pkSecretKey: 'key',
          },
        },
        {
          provide: PostRepository,
          useValue: {
            findPostEntityListAndCount: jest.fn(),
            findPostEntityListAndCountByPostPageDto: jest.fn(),
          },
        },
        {
          provide: PostLikeService,
          useValue: {
            getPostLikeNicknameList: jest.fn(),
          },
        },
      ],
    }).compile();

    postService = module.get(PostService);
    config = module.get(authConfig.KEY);
    postRepository = module.get(PostRepository);
    postLikeService = module.get(PostLikeService);
  });

  describe('getPostPageListByPage', () => {
    it('Test getPostDtoList', async () => {
      // Given
      const expected = 1;

      postRepository.findPostEntityListAndCountByPage = jest
        .fn()
        .mockResolvedValue([
          [
            new PostEntity(
              expected,
              'postUid',
              'title',
              new Date(),
              'contents',
              0,
            ),
          ],
          1,
        ]);

      postLikeService.getPostLikeNicknameList = jest.fn().mockResolvedValue([]);

      // When
      const actual = await postService.getPostPageListByPage(1);

      // Then
      expect(
        Number(
          CryptoUtils.decryptPrimaryKey(
            actual.data[0].postId,
            config.pkSecretKey,
          ),
        ),
      ).toEqual(expected);
    });

    it('Test when there is no post.', async () => {
      // Given
      postRepository.findPostEntityListAndCountByPage = jest
        .fn()
        .mockResolvedValue([[], 0]);

      // When
      const actual = await postService.getPostPageListByPage(1);

      // Then
      expect(actual.data).toEqual([]);
    });
  });

  describe('getPostPageListByPostPageRequestDto', () => {
    it('Test getPostPageListByPostPageRequestDto', async () => {
      // Given
      const expected = 1;
      const postUid = 'postUid';

      postRepository.findPostEntityListAndCountByPostPageDto = jest
        .fn()
        .mockResolvedValue([
          [
            new PostEntity(
              expected,
              'postUid',
              'title',
              new Date(),
              'contents',
              0,
            ),
          ],
          1,
        ]);

      postLikeService.getPostLikeNicknameList = jest.fn().mockResolvedValue([]);

      // When
      const actual = await postService.getPostPageListByPostPageRequestDto(
        new PostPageRequestDto(postUid, 1),
      );

      // Then
      expect(
        Number(
          CryptoUtils.decryptPrimaryKey(
            actual.data[0].postId,
            config.pkSecretKey,
          ),
        ),
      ).toEqual(expected);
    });

    it("Test when there is no postUid's post.", async () => {
      // Given
      postRepository.findPostEntityListAndCountByPostPageDto = jest
        .fn()
        .mockResolvedValue([[], 0]);

      // When
      const actual = await postService.getPostPageListByPostPageRequestDto(
        new PostPageRequestDto('encryptedPostUid', 1),
      );

      // Then
      expect(actual.data).toEqual([]);
    });
  });
});
