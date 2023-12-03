import { PostRepository } from '../repository/post.repository';
import { PostLikeService } from './post-like.serivce';
import { PostService } from './post.serivce';
import authConfig from '../../config/authConfig';
import { Test } from '@nestjs/testing';
import { PostDao } from '../dao/post.dao';
import { ConfigType } from '@nestjs/config';
import { CryptoUtils } from '../../utils/crypto.utils';
import { PostPageRequestDto } from '../dto/post-page-request.dto';

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
            findPostDaoListAndCount: jest.fn(),
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

      postRepository.findPostDaoListAndCountByPage = jest
        .fn()
        .mockResolvedValue([
          [
            PostDao.from({
              postId: expected,
              postUid: 'postUid',
              title: 'title',
              writeDatetime: new Date(),
              contents: 'contents',
              hits: 0,
            }),
          ],
          1,
        ]);

      postLikeService.getPostLikeNicknameList = jest.fn().mockResolvedValue([]);

      // When
      const actual = await postService.getPostPageListByPage(1);

      // Then
      expect(
        Number(
          CryptoUtils.decryptPostPK(actual.data[0].postId, config.pkSecretKey),
        ),
      ).toEqual(expected);
    });

    it('Test when there is no post.', async () => {
      // Given
      postRepository.findPostDaoListAndCountByPage = jest
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

      postRepository.findPostDaoListAndCountByPostPageRequestDto = jest
        .fn()
        .mockResolvedValue([
          [
            PostDao.from({
              postId: expected,
              postUid: postUid,
              title: 'title',
              writeDatetime: new Date(),
              contents: 'contents',
              hits: 0,
            }),
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
          CryptoUtils.decryptPostPK(actual.data[0].postId, config.pkSecretKey),
        ),
      ).toEqual(expected);
    });

    it("Test when there is no postUid's post.", async () => {
      // Given
      postRepository.findPostDaoListAndCountByPostPageRequestDto = jest
        .fn()
        .mockResolvedValue([[], 0]);

      // When
      const actual = await postService.getPostPageListByPostPageRequestDto(
        new PostPageRequestDto('postUid', 1),
      );

      // Then
      expect(actual.data).toEqual([]);
    });
  });
});
