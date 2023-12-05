import { Test } from '@nestjs/testing';
import { JwtService } from './jwt.service';
import authConfig from '../config/authConfig';
import { UserRole } from '../constant/user-role.enum';
import { UserAuthRepository } from '../user/repository/user-auth.repository';
import * as jwt from 'jsonwebtoken';
import { CryptoUtils } from '../utils/crypto.utils';
import { ConfigType } from '@nestjs/config';
import { UserSessionDto } from '../user/dto/user-session.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtService', () => {
  let jwtService: JwtService;
  let config: ConfigType<typeof authConfig>;
  let userAuthRepository: UserAuthRepository;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtService,
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
          },
        },
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
            getUserSessionDto: jest.fn(),
          },
        },
      ],
    }).compile();

    jwtService = module.get(JwtService);
    config = module.get(authConfig.KEY);
    userAuthRepository = module.get(UserAuthRepository);
  });

  describe('create Token', () => {
    it('create new token', async () => {
      const expectUid = 'uid@test.com';
      const userRole = UserRole.USER;

      const accessToken = (await jwtService.create(expectUid, userRole))
        .accessToken;

      const actualUid = CryptoUtils.decryptPostPK(
        (jwt.verify(accessToken, config.jwtSecretKey) as jwt.JwtPayload)['uid'],
        config.pkSecretKey,
      );

      expect(actualUid).toEqual(expectUid);
    });
  });

  describe('Reissue Token', () => {
    it('Test reissue access token', async () => {
      const expectUid = 'uid@test.com';
      const userRole = UserRole.USER;
      const refreshToken = (await jwtService.create(expectUid, userRole))
        .refreshToken;
      const userSessionDto = new UserSessionDto(
        expectUid,
        refreshToken,
        userRole,
      );

      const accessToken = (
        await jwtService.reissueJwtByUserSessionDto(userSessionDto)
      ).accessToken;
      const actualUid = CryptoUtils.decryptPostPK(
        (jwt.verify(accessToken, config.jwtSecretKey) as jwt.JwtPayload)['uid'],
        config.pkSecretKey,
      );

      expect(actualUid).toEqual(expectUid);
    });

    it('Test verify refresh token throw error', async () => {
      const expectUid = 'uid@test.com';
      const userRole = UserRole.USER;
      const refreshToken = (await jwtService.create(expectUid, userRole))
        .refreshToken;
      const userSessionDto = new UserSessionDto(expectUid, null, userRole);

      userAuthRepository.getUserSessionDtoByUid = jest
        .fn()
        .mockResolvedValue(userSessionDto);

      await expect(jwtService.verifyRefreshToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
