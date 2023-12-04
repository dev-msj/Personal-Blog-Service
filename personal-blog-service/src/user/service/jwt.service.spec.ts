import { Test } from '@nestjs/testing';
import { JwtService } from './jwt.service';
import authConfig from '../../config/authConfig';
import { UserRole } from '../../constant/user-role.enum';
import { UserAuthRepository } from '../repository/user-auth.repository';
import * as jwt from 'jsonwebtoken';
import { CryptoUtils } from './../../utils/crypto.utils';
import { ConfigType } from '@nestjs/config';

describe('JwtService', () => {
  let jwtService: JwtService;
  let config: ConfigType<typeof authConfig>;
  let userAuthRepository: UserAuthRepository;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtService,
        {
          provide: authConfig.KEY,
          useValue: {
            pkSecretKey: 'key',
            jwtSecretKey: 'key',
            jwtIssuer: 'issuer',
            accessTokenExpireTime: '1h',
            refreshTokenExpireTime: '2w',
          },
        },
        {
          provide: UserAuthRepository,
          useValue: {
            updateUserAuthByUserSessionDto: jest.fn(),
          },
        },
      ],
    }).compile();

    jwtService = module.get(JwtService);
    config = module.get(authConfig.KEY);
    userAuthRepository = module.get(UserAuthRepository);
  });

  describe('createToken', () => {
    it('create new token', async () => {
      const expectUid = 'uid@test.com';
      const role = UserRole.USER;

      const accessToken = (await jwtService.create(expectUid, role))
        .accessToken;

      const actualUid = CryptoUtils.decryptPostPK(
        (jwt.verify(accessToken, config.jwtSecretKey) as jwt.JwtPayload)['uid'],
        config.pkSecretKey,
      );

      expect(actualUid).toEqual(expectUid);
    });
  });
});
