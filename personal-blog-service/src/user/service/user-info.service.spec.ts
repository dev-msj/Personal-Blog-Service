import { UserInfoRepository } from '../repository/user-info.repository';
import { Test } from '@nestjs/testing';
import { UserInfoService } from './user-info.service';
import { UserInfoEntity } from '../entities/user-info.entity';

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
            findUserInfoEntity: jest.fn(),
          },
        },
      ],
    }).compile();

    userInfoService = module.get(UserInfoService);
    userInfoRepository = module.get(UserInfoRepository);
  });

  describe('getUserInfoByUid', () => {
    it('Test getUserInfoByUid', async () => {
      const uid = 'uid';

      userInfoRepository.findUserInfoEntity = jest
        .fn()
        .mockResolvedValue(new UserInfoEntity(uid, 'nickname', 'introduce'));

      const userInfoDto = await userInfoService.getUserInfoByUid(uid);

      expect(userInfoDto.uid).toEqual(uid);
    });
  });
});
