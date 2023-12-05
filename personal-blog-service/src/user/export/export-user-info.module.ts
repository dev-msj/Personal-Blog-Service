import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserInfoEntity } from '../entities/user-info.entity';
import { UserInfoService } from '../service/user-info.service';
import { UserInfoRepository } from '../repository/user-info.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserInfoEntity])],
  providers: [UserInfoService, UserInfoRepository],
  exports: [UserInfoService],
})
export class ExportUserInfoModule {}
