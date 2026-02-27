import { Test } from '@nestjs/testing';
import { JwtService } from './jwt.service';
import * as jwt from 'jsonwebtoken';
import { ConfigType } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import authConfig from '../../config/authConfig';
import { AuthInvalidRefreshTokenException } from '../../exception/auth';
import { UserRole } from '../../constant/user-role.enum';
import { CryptoUtils } from '../../utils/crypto.utils';
import { UserSessionEntity } from '../entities/user-session.entity';
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
    it('갱신 시 access token과 refresh token 모두 새로 발급된다', async () => {
      // Given
      const expectUid = 'uid@test.com';
      const userRole = UserRole.USER;
      const originalJwt = await jwtService.create(expectUid, userRole);
      const userSessionEntity = new UserSessionEntity(
        expectUid,
        originalJwt.refreshToken,
        userRole,
      );

      // When
      const reissuedJwt =
        await jwtService.reissueJwtByUserSessionEntity(userSessionEntity);

      // Then: 새 access token이 유효한 uid를 포함한다
      const actualUid = CryptoUtils.decryptPrimaryKey(
        (
          jwt.verify(
            reissuedJwt.accessToken,
            config.jwtSecretKey,
          ) as jwt.JwtPayload
        )['uid'],
        config.pkSecretKey,
      );
      expect(actualUid).toEqual(expectUid);

      // Then: refresh token도 새로 발급되어 기존과 다르다
      expect(reissuedJwt.refreshToken).toBeDefined();
      expect(reissuedJwt.refreshToken).not.toEqual(originalJwt.refreshToken);
    });

    it('Test verify refresh token throw error', async () => {
      // Given
      const expectUid = 'uid@test.com';
      const userRole = UserRole.USER;
      const refreshToken = (await jwtService.create(expectUid, userRole))
        .refreshToken;
      const userSessionEntity = new UserSessionEntity(expectUid, '', userRole);

      userAuthRepository.getUserSessionEntityByUid = jest
        .fn()
        .mockResolvedValue(userSessionEntity);

      // When
      const actualException = await jwtService.verifyRefreshToken(refreshToken);

      // Then
      expect(actualException).toBeInstanceOf(AuthInvalidRefreshTokenException);
    });
  });
});
