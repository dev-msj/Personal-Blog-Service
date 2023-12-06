import { Module } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAuthEntity } from '../user/entities/user-auth.entity';
import { UserAuthRepository } from '../user/repository/user-auth.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserAuthEntity])],
  providers: [JwtService, UserAuthRepository],
  exports: [JwtService],
})
export class AuthModule {}
