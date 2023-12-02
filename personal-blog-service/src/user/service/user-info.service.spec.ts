import { UserInfoDao } from '../dao/user-info.dao';
import { UserInfoRepository } from '../repository/user-info.repository';
import { Test } from '@nestjs/testing';
import { UserInfoService } from './user-info.service';

describe('UserInfoService', () => {
  let userInfoService: UserInfoService;
  let userInfoRepository: UserInfoRepository;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserInfoService,
        {
          provide: UserInfoRepository,
          useValue: {
            findUserInfoDao: jest.fn(),
          },
        },
      ],
    }).compile();

    userInfoService = module.get(UserInfoService);
    userInfoRepository = module.get(UserInfoRepository);
  });

  describe('getUserInfoDto', () => {
    it('Test getUserInfoDto', async () => {
      const uid = 'uid';

      userInfoRepository.findUserInfoDao = jest.fn().mockResolvedValue(
        UserInfoDao.from({
          uid,
          nickname: 'nickname',
          introduce: 'introduce',
        }),
      );

      const userInfoDto = await userInfoService.getUserInfoDto(uid);

      expect(userInfoDto.uid).toEqual(uid);
    });
  });
});
