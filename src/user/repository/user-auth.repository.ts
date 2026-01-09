import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserAuthEntity } from '../entities/user-auth.entity';
import { DataSource, EntityNotFoundError, Repository } from 'typeorm';
import { UserSessionEntity } from '../entities/user-session.entity';
import { CacheIdUtils } from '../../utils/cache-id.utils';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { TimeUtils } from '../../utils/time.utils';

@Injectable()
export class UserAuthRepository {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
    @InjectRepository(UserAuthEntity)
    private readonly userAuthRepository: Repository<UserAuthEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async saveUserAuthEntity(userAuthEntity: UserAuthEntity) {
    await this.userAuthRepository.insert(userAuthEntity);
  }

  async getUserAuthEntity(uid: string): Promise<UserAuthEntity> {
    try {
      return await this.userAuthRepository.findOneByOrFail({ uid });
    } catch {
      this.dataSource.queryResultCache?.remove([
        CacheIdUtils.getUserAuthEntityCacheId(uid),
      ]);

      throw new NotFoundException(`User does not exist! - [${uid}]`);
    }
  }

  async isExist(uid: string): Promise<boolean> {
    return await this.userAuthRepository.exist({ where: { uid: uid } });
  }

  async getUserSessionEntityByUid(uid: string): Promise<UserSessionEntity> {
    try {
      const userAuthEntity = await this.userAuthRepository.findOneOrFail({
        where: { uid },
        select: ['uid', 'refreshToken', 'userRole'],
        cache: {
          id: CacheIdUtils.getUserSessionEntityCacheId(uid),
          milliseconds: TimeUtils.getTicTimeHMS(6),
        },
      });

      return new UserSessionEntity(
        userAuthEntity.uid,
        userAuthEntity.refreshToken,
        userAuthEntity.userRole,
      );
    } catch (error) {
      this.dataSource.queryResultCache?.remove([
        CacheIdUtils.getUserSessionEntityCacheId(uid),
      ]);

      if (error instanceof EntityNotFoundError) {
        throw new NotFoundException(`User does not exist! - [${uid}]`);
      }

      throw error;
    }
  }

  async updateUserAuthByUserSessionEntity(
    userSessionEntity: UserSessionEntity,
  ): Promise<void> {
    this.dataSource.queryResultCache?.remove([
      CacheIdUtils.getUserSessionEntityCacheId(userSessionEntity.uid),
    ]);

    await this.userAuthRepository.update(
      {
        uid: userSessionEntity.uid,
      },
      userSessionEntity,
    );

    this.logger.info(
      `UserAuthEntity is updated. - [${JSON.stringify(userSessionEntity)}]`,
    );
  }
}
