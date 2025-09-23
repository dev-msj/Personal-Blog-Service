import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserAuthEntity } from '../entities/user-auth.entity';
import { DataSource, Repository } from 'typeorm';
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
    await this.userAuthRepository.save(userAuthEntity);
  }

  async getUserAuthEntity(uid: string): Promise<UserAuthEntity> {
    return (
      (await this.userAuthRepository.findOne({
        where: { uid: uid },
      })) ||
      (() => {
        this.dataSource.queryResultCache.remove([
          CacheIdUtils.getUserAuthEntityCacheId(uid),
        ]);

        throw new NotFoundException(`User does not exist! - [${uid}]`);
      })()
    );
  }

  async isExist(uid: string): Promise<boolean> {
    return await this.userAuthRepository.exist({ where: { uid: uid } });
  }

  async getUserSessionEntityByUid(uid: string): Promise<UserSessionEntity> {
    return (
      (await this.userAuthRepository
        .createQueryBuilder('userAuthEntity')
        .select('userAuthEntity.uid', 'uid')
        .addSelect('userAuthEntity.refreshToken', 'refreshToken')
        .addSelect('userAuthEntity.userRole', 'userRole')
        .where({ uid: uid })
        .cache(
          CacheIdUtils.getUserSessionEntityCacheId(uid),
          TimeUtils.getTicTimeHMS(6),
        )
        .getRawOne<UserSessionEntity>()) ||
      (() => {
        this.dataSource.queryResultCache.remove([
          CacheIdUtils.getUserSessionEntityCacheId(uid),
        ]);

        throw new NotFoundException(`User does not exist! - [${uid}]`);
      })()
    );
  }

  async updateUserAuthByUserSessionEntity(
    userSessionEntity: UserSessionEntity,
  ): Promise<void> {
    this.dataSource.queryResultCache.remove([
      CacheIdUtils.getUserSessionEntityCacheId(userSessionEntity.uid),
    ]);

    this.userAuthRepository.update(
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
