import { PostRepository } from '../repository/post.repository';
import { PostLikeService } from './post-like.service';
import { PostService } from './post.service';
import { Test } from '@nestjs/testing';
import { PostEntity } from '../entities/post.entity';

describe('PostService', () => {
  let postService: PostService;
  let postRepository: PostRepository;
  let postLikeService: PostLikeService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: PostRepository,
          useValue: {
            findPostEntityListAndCount: jest.fn(),
            findPostEntityListAndCountByPostPageDto: jest.fn(),
            findPostEntityListAndCountByPage: jest.fn(),
            findPostEntityByPostId: jest.fn(),
          },
        },
        {
          provide: PostLikeService,
          useValue: {
            getPostLikeMapByPostIds: jest.fn(),
          },
        },
      ],
    }).compile();

    postService = module.get(PostService);
    postRepository = module.get(PostRepository);
    postLikeService = module.get(PostLikeService);
  });

  describe('getPostPageListByPage', () => {
    it('게시글 목록 조회 성공', async () => {
      // Given
      const expectedPostId = 1;
      postRepository.findPostEntityListAndCountByPage = jest
        .fn()
        .mockResolvedValue([
          [
            new PostEntity(
              expectedPostId,
              'postUid',
              'title',
              new Date(),
              'contents',
              0,
            ),
          ],
          1,
        ]);
      postLikeService.getPostLikeMapByPostIds = jest
        .fn()
        .mockResolvedValue(new Map([[expectedPostId, []]]));

      // When
      const result = await postService.getPostPageListByPage(1);

      // Then
      expect(result.data[0].postId).toBe(expectedPostId);
    });

    it('게시글이 없을 때 빈 배열 반환', async () => {
      // Given
      postRepository.findPostEntityListAndCountByPage = jest
        .fn()
        .mockResolvedValue([[], 0]);
      postLikeService.getPostLikeMapByPostIds = jest
        .fn()
        .mockResolvedValue(new Map());

      // When
      const result = await postService.getPostPageListByPage(1);

      // Then
      expect(result.data).toEqual([]);
      expect(result.paginationMeta.total).toBe(0);
    });

    it('페이지네이션 메타데이터가 정확히 계산됨', async () => {
      // Given
      const totalPosts = 45;
      const currentPage = 2;
      const mockPosts = [
        new PostEntity(21, 'uid', 'title', new Date(), 'contents', 0),
      ];

      postRepository.findPostEntityListAndCountByPage = jest
        .fn()
        .mockResolvedValue([mockPosts, totalPosts]);
      postLikeService.getPostLikeMapByPostIds = jest
        .fn()
        .mockResolvedValue(new Map([[21, []]]));

      // When
      const result = await postService.getPostPageListByPage(currentPage);

      // Then
      expect(result.paginationMeta.total).toBe(45);
      expect(result.paginationMeta.currentPage).toBe(2);
      expect(result.paginationMeta.lastPage).toBe(3);
    });

    it('범위를 벗어난 페이지 조회 시 빈 배열 반환', async () => {
      // Given
      const invalidPage = 999;
      postRepository.findPostEntityListAndCountByPage = jest
        .fn()
        .mockResolvedValue([[], 45]);
      postLikeService.getPostLikeMapByPostIds = jest
        .fn()
        .mockResolvedValue(new Map());

      // When
      const result = await postService.getPostPageListByPage(invalidPage);

      // Then
      expect(result.data).toEqual([]);
    });

    it('여러 게시글의 좋아요 목록이 조회됨', async () => {
      // Given
      const mockPosts = [
        new PostEntity(1, 'uid1', 'title1', new Date(), 'contents1', 0),
        new PostEntity(2, 'uid2', 'title2', new Date(), 'contents2', 0),
      ];

      postRepository.findPostEntityListAndCountByPage = jest
        .fn()
        .mockResolvedValue([mockPosts, 2]);

      postLikeService.getPostLikeMapByPostIds = jest.fn().mockResolvedValue(
        new Map([
          [1, ['user1', 'user2']],
          [2, []],
        ]),
      );

      // When
      const result = await postService.getPostPageListByPage(1);

      // Then
      expect(result.data[0].postLikeNicknameList).toEqual(['user1', 'user2']);
      expect(result.data[1].postLikeNicknameList).toEqual([]);
    });
  });

  describe('getPostPageListByPostUid', () => {
    it('특정 유저의 게시글 목록 조회 성공', async () => {
      // Given
      const expectedPostId = 1;
      const testUid = 'testUid';

      postRepository.findPostEntityListAndCountByPostPageDto = jest
        .fn()
        .mockResolvedValue([
          [
            new PostEntity(
              expectedPostId,
              testUid,
              'title',
              new Date(),
              'contents',
              0,
            ),
          ],
          1,
        ]);
      postLikeService.getPostLikeMapByPostIds = jest
        .fn()
        .mockResolvedValue(new Map([[expectedPostId, []]]));

      // When
      const result = await postService.getPostPageListByPostUid(testUid, 1);

      // Then
      expect(result.data[0].postId).toBe(expectedPostId);
      expect(
        postRepository.findPostEntityListAndCountByPostPageDto,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          postUid: testUid,
          page: 1,
        }),
      );
    });

    it('해당 유저의 게시글이 없을 때 빈 배열 반환', async () => {
      // Given
      const testUid = 'testUid';

      postRepository.findPostEntityListAndCountByPostPageDto = jest
        .fn()
        .mockResolvedValue([[], 0]);
      postLikeService.getPostLikeMapByPostIds = jest
        .fn()
        .mockResolvedValue(new Map());

      // When
      const result = await postService.getPostPageListByPostUid(testUid, 1);

      // Then
      expect(result.data).toEqual([]);
      expect(result.paginationMeta.total).toBe(0);
    });

    it('페이지네이션 메타데이터가 정확히 계산됨', async () => {
      // Given
      const userUid = 'prolificUser';
      const totalPosts = 50;

      postRepository.findPostEntityListAndCountByPostPageDto = jest
        .fn()
        .mockResolvedValue([
          [new PostEntity(1, userUid, 'title', new Date(), 'contents', 0)],
          totalPosts,
        ]);
      postLikeService.getPostLikeMapByPostIds = jest
        .fn()
        .mockResolvedValue(new Map([[1, []]]));

      // When
      const result = await postService.getPostPageListByPostUid(userUid, 1);

      // Then
      expect(result.paginationMeta.total).toBe(50);
      expect(result.paginationMeta.lastPage).toBe(3);
    });
  });

  describe('getPostByPostId', () => {
    it('게시글 단건 조회 성공', async () => {
      // Given
      const postId = 123;

      postRepository.findPostEntityByPostId = jest
        .fn()
        .mockResolvedValue(
          new PostEntity(postId, 'testUid', 'title', new Date(), 'contents', 0),
        );
      postLikeService.getPostLikeMapByPostIds = jest
        .fn()
        .mockResolvedValue(new Map([[postId, []]]));

      // When
      const result = await postService.getPostByPostId(postId);

      // Then
      expect(result.postId).toBe(postId);
    });

    it('좋아요 목록이 포함되어 조회됨', async () => {
      // Given
      const postId = 123;
      const expectedLikes = ['user1'];

      postRepository.findPostEntityByPostId = jest
        .fn()
        .mockResolvedValue(
          new PostEntity(postId, 'testUid', 'title', new Date(), 'contents', 0),
        );
      postLikeService.getPostLikeMapByPostIds = jest
        .fn()
        .mockResolvedValue(new Map([[postId, expectedLikes]]));

      // When
      const result = await postService.getPostByPostId(postId);

      // Then
      expect(result.postLikeNicknameList).toEqual(expectedLikes);
    });

    it('존재하지 않는 게시글 조회 시 에러 발생', async () => {
      // Given
      const postId = 999;
      postRepository.findPostEntityByPostId = jest
        .fn()
        .mockRejectedValue(new Error('Entity not found'));

      // When & Then
      await expect(postService.getPostByPostId(postId)).rejects.toThrow(
        'Entity not found',
      );
    });
  });
});
