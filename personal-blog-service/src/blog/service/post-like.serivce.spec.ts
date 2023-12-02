import { PostLikeService } from './post-like.serivce';
import { Test } from '@nestjs/testing';
import { PostLikeRepository } from '../repository/post-like.repository';
import { PostLikeDao } from '../dao/post-like.dao';
import { UserInfoService } from '../../user/service/user-info.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { UserInfoDto } from '../../user/dto/user-info.dto';

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
          useValue: {},
        },
        {
          provide: PostLikeRepository,
          useValue: {
            findPostLikeDaoList: jest.fn(),
          },
        },
        {
          provide: UserInfoService,
          useValue: {
            getUserInfoDto: jest.fn(),
          },
        },
      ],
    }).compile();

    postLikeService = module.get(PostLikeService);
    postLikeRepository = module.get(PostLikeRepository);
    userInfoService = module.get(UserInfoService);
  });

  describe('getPostLikeNicknameList', () => {
    it('test get nickname list', async () => {
      // Given
      const postUid = 'postUid';
      const postId = 0;
      const uid = 'uid';
      const expected = 'nickname';
      const postLikeDao = PostLikeDao.from({ postUid, postId, uid });

      postLikeRepository.findPostLikeDaoList = jest
        .fn()
        .mockResolvedValue([postLikeDao]);

      userInfoService.getUserInfoDto = jest
        .fn()
        .mockResolvedValue(new UserInfoDto(uid, expected, 'introduce'));

      // When
      const actual = await postLikeService.getPostLikeNicknameList(
        postUid,
        postId,
      );

      // Then
      expect(actual[0]).toEqual(expected);
    });
  });
});
