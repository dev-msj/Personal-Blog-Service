import { Module } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { ExportUserAuthModule } from '../user/export/export-user-auth.module';

@Module({
  imports: [ExportUserAuthModule],
  providers: [JwtService],
  exports: [JwtService],
})
export class AuthModule {}
