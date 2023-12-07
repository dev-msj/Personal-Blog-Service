import authConfig from '../../config/authConfig';
import { JwtService } from './jwt.service';
import { Test } from '@nestjs/testing';
import { UserRole } from '../../constant/user-role.enum';
import { UserAuthService } from './user-auth.service';
import { UserAuthRepository } from './../repository/user-auth.repository';
import { JwtDto } from '../dto/jwt.dto';
import { UserAuthRequestDto } from '../dto/user-auth-request.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { UnauthorizedException } from '@nestjs/common';
import { UserAuthEntity } from '../entities/user-auth.entity';

describe('UserAuthService', () => {
  let userAuthService: UserAuthService;
  let jwtService: JwtService;
  let userAuthRepository: UserAuthRepository;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserAuthService,
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
          },
        },
        {
          provide: authConfig.KEY,
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: UserAuthRepository,
          useValue: {
            getUserAuthEntity: jest.fn(),
            saveUserAuthEntity: jest.fn(),
            isExist: jest.fn(),
          },
        },
      ],
    }).compile();

    userAuthService = module.get(UserAuthService);
    jwtService = module.get(JwtService);
    userAuthRepository = module.get(UserAuthRepository);
  });

  describe('createNewUser', () => {
    it('Test user create success', async () => {
      // Given
      const expectJwtDto = new JwtDto('accessToken', 'refreshToken');

      jwtService.create = jest.fn().mockResolvedValue(expectJwtDto);

      // When
      const actualJwtDto = await userAuthService.createNewUser(
        new UserAuthRequestDto('uid', 'password'),
      );

      // Then
      expect(userAuthRepository.saveUserAuthEntity).toHaveBeenCalled();
      expect(actualJwtDto.accessToken).toEqual(expectJwtDto.accessToken);
    });
  });

  describe('login', () => {
    it('Test login success.', async () => {
      // Given
      const expectJwtDto = new JwtDto('accessToken', 'refreshToken');
      const uid = 'uid';
      const password = 'password';

      userAuthRepository.getUserAuthEntity = jest
        .fn()
        .mockResolvedValue(
          new UserAuthEntity(
            uid,
            password,
            'salt',
            'N',
            expectJwtDto.refreshToken,
            UserRole.USER,
          ),
        );

      jwtService.create = jest.fn().mockResolvedValue(expectJwtDto);
      userAuthService['hashingPassword'] = jest.fn().mockReturnValue(password);

      // When
      const actualJwtDto = await userAuthService.login(
        new UserAuthRequestDto(uid, password),
      );

      // Then
      expect(actualJwtDto.accessToken).toEqual(expectJwtDto.accessToken);
    });

    it('Test login failure.', async () => {
      // Given
      const uid = 'uid';
      const password = 'password';

      userAuthRepository.getUserAuthEntity = jest
        .fn()
        .mockResolvedValue(
          new UserAuthEntity(
            uid,
            password,
            'salt',
            'N',
            'refreshToken',
            UserRole.USER,
          ),
        );

      userAuthService['hashingPassword'] = jest
        .fn()
        .mockReturnValue('hashedPassword');

      // Then
      await expect(
        userAuthService.login(new UserAuthRequestDto(uid, password)),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('googleOauthLogin', () => {
    it('Test google oauth login success when user exist.', async () => {
      // Given
      const expectJwtDto = new JwtDto('accessToken', 'refreshToken');
      const uid = 'uid';

      userAuthService['decodeCredentialToken'] = jest.fn().mockResolvedValue({
        getPayload() {
          return { email: uid };
        },
      });
      userAuthRepository.isExist = jest.fn().mockResolvedValue(true);
      jwtService.create = jest.fn().mockResolvedValue(expectJwtDto);

      // When
      const actualJwtDto =
        await userAuthService.googleOauthLogin('credentialToken');

      // Then
      expect(actualJwtDto.accessToken).toEqual(actualJwtDto.accessToken);
    });

    it('Test google oauth login success when user not exist.', async () => {
      // Given
      const expectJwtDto = new JwtDto('accessToken', 'refreshToken');
      const uid = 'uid';

      userAuthService['decodeCredentialToken'] = jest.fn().mockResolvedValue({
        getPayload() {
          return { email: uid };
        },
      });
      userAuthRepository.isExist = jest.fn().mockResolvedValue(false);
      jwtService.create = jest.fn().mockResolvedValue(expectJwtDto);

      // When
      const actualJwtDto =
        await userAuthService.googleOauthLogin('credentialToken');

      // Then
      expect(userAuthRepository.saveUserAuthEntity).toHaveBeenCalled();
      expect(actualJwtDto.accessToken).toEqual(actualJwtDto.accessToken);
    });
  });
});
