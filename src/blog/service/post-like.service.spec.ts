import { PostLikeService } from './post-like.service';
import { Test } from '@nestjs/testing';
import { PostLikeRepository } from '../repository/post-like.repository';
import { PostLikeDao } from '../dao/post-like.dao';
import { UserInfoService } from '../../user/service/user-info.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { UserInfoDto } from '../../user/dto/user-info.dto';
import authConfig from '../../config/authConfig';

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
          provide: authConfig.KEY,
          useValue: {},
        },
        {
          provide: PostLikeRepository,
          useValue: {
            findPostLikeEntityList: jest.fn(),
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

  describe('getPostLikeNicknameList', () => {
    it('test get nickname list', async () => {
      // Given
      const postId = 0;
      const uid = 'uid';
      const expected = 'nickname';

      postLikeRepository.findPostLikeEntityList = jest
        .fn()
        .mockResolvedValue([PostLikeDao.from({ postId, uid })]);

      userInfoService.getUserInfoByUid = jest
        .fn()
        .mockResolvedValue(new UserInfoDto(uid, expected, 'introduce'));

      // When
      const actual = await postLikeService.getPostLikeNicknameList(postId);

      // Then
      expect(actual[0]).toEqual(expected);
    });

    it('Test when there is no post like user.', async () => {
      // Given
      postLikeRepository.findPostLikeEntityList = jest
        .fn()
        .mockResolvedValue([]);

      // When
      const actual = await postLikeService.getPostLikeNicknameList(0);

      // Then
      expect(actual).toEqual([]);
    });
  });
});
