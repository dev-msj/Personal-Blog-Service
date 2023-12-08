import { Test } from '@nestjs/testing';
import { JwtService } from './jwt.service';
import * as jwt from 'jsonwebtoken';
import { ConfigType } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { UnauthorizedException } from '@nestjs/common';
import authConfig from '../../config/authConfig';
import { UserRole } from '../../constant/user-role.enum';
import { CryptoUtils } from '../../utils/crypto.utils';
import { UserSessionEntity } from '../entities/user-session.dto';
import { UserAuthRepository } from '../repository/user-auth.repository';

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
            warn: jest.fn(),
            error: jest.fn(),
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
            updateUserAuthByUserSessionEntity: jest.fn(),
            getUserSessionEntity: jest.fn(),
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
      // Given
      const expectUid = 'uid@test.com';
      const userRole = UserRole.USER;

      // When
      const accessToken = (await jwtService.create(expectUid, userRole))
        .accessToken;
      const actualUid = CryptoUtils.decryptPrimaryKey(
        (jwt.verify(accessToken, config.jwtSecretKey) as jwt.JwtPayload)['uid'],
        config.pkSecretKey,
      );

      // Then
      expect(actualUid).toEqual(expectUid);
    });
  });

  describe('Reissue Token', () => {
    it('Test reissue access token', async () => {
      // Given
      const expectUid = 'uid@test.com';
      const userRole = UserRole.USER;
      const refreshToken = (await jwtService.create(expectUid, userRole))
        .refreshToken;
      const userSessionEntity = new UserSessionEntity(
        expectUid,
        refreshToken,
        userRole,
      );

      // When
      const accessToken = (
        await jwtService.reissueJwtByUserSessionEntity(userSessionEntity)
      ).accessToken;
      const actualUid = CryptoUtils.decryptPrimaryKey(
        (jwt.verify(accessToken, config.jwtSecretKey) as jwt.JwtPayload)['uid'],
        config.pkSecretKey,
      );

      // Then
      expect(actualUid).toEqual(expectUid);
    });

    it('Test verify refresh token throw error', async () => {
      // Given
      const expectUid = 'uid@test.com';
      const userRole = UserRole.USER;
      const refreshToken = (await jwtService.create(expectUid, userRole))
        .refreshToken;
      const userSessionEntity = new UserSessionEntity(
        expectUid,
        null,
        userRole,
      );

      userAuthRepository.getUserSessionEntityByUid = jest
        .fn()
        .mockResolvedValue(userSessionEntity);

      // When
      const actualException = await jwtService.verifyRefreshToken(refreshToken);

      // Then
      expect(actualException).toBeInstanceOf(UnauthorizedException);
    });
  });
});
