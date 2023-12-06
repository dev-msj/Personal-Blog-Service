import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserAuthEntity } from '../entities/user-auth.entity';
import { DataSource, Repository } from 'typeorm';
import { UserSessionDto } from '../dto/user-session.dto';
import { CacheIdUtils } from '../../utils/cache-id.utils';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { TimeUtils } from '../../utils/time.utills';

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

  async getUserSessionDtoByUid(uid: string): Promise<UserSessionDto> {
    return (
      (await this.userAuthRepository
        .createQueryBuilder('userAuthEntity')
        .select('userAuthEntity.uid', 'uid')
        .addSelect('userAuthEntity.refreshToken', 'refreshToken')
        .addSelect('userAuthEntity.userRole', 'userRole')
        .where({ uid: uid })
        .cache(
          CacheIdUtils.getUserSessionDtoCacheId(uid),
          TimeUtils.getTicTimeHMS(6),
        )
        .getRawOne<UserSessionDto>()) ||
      (() => {
        this.dataSource.queryResultCache.remove([
          CacheIdUtils.getUserSessionDtoCacheId(uid),
        ]);

        throw new NotFoundException(`User does not exist! - [${uid}]`);
      })()
    );
  }

  async updateUserAuthByUserSessionDto(
    userSessionDto: UserSessionDto,
  ): Promise<void> {
    this.dataSource.queryResultCache.remove([
      CacheIdUtils.getUserSessionDtoCacheId(userSessionDto.uid),
    ]);

    this.userAuthRepository.update(
      {
        uid: userSessionDto.uid,
      },
      userSessionDto,
    );

    this.logger.info(
      `UserAuthEntity is updated. - [${JSON.stringify(userSessionDto)}]`,
    );
  }
}
