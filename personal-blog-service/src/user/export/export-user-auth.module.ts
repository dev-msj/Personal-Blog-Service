import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAuthEntity } from '../entities/user-auth.entity';
import { UserAuthRepository } from '../repository/user-auth.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserAuthEntity])],
  providers: [UserAuthRepository],
  exports: [UserAuthRepository],
})
export class ExportUserAuthModule {}
