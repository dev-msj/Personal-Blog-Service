import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAuthEntity } from './entities/user-auth.entity';
import { UserInfoEntity } from './entities/user-info.entity';
import { Module } from '@nestjs/common';
import { UserInfoService } from './service/user-info.service';
import { UserInfoRepository } from './repository/user-info.repository';
import { UserAuthRepository } from './repository/user-auth.repository';
import { UserAuthController } from './controller/user-auth.controller';
import { JwtService } from '../auth/jwt.service';
import { UserAuthService } from './service/user-auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserInfoEntity, UserAuthEntity])],
  controllers: [UserAuthController],
  providers: [
    UserInfoService,
    UserInfoRepository,
    UserAuthService,
    UserAuthRepository,
    JwtService,
  ],
})
export class UserModule {}
