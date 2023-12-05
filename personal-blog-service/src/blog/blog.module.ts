import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostEntity } from './entities/post.entity';
import { PostController } from './controller/post.controller';
import { PostService } from './service/post.serivce';
import { PostLikeEntity } from './entities/post-like.entity';
import { PostLikeService } from './service/post-like.serivce';
import { UserInfoEntity } from '../user/entities/user-info.entity';
import { PostRepository } from './repository/post.repository';
import { PostLikeRepository } from './repository/post-like.repository';
import { ExportUserInfoModule } from '../user/export/export-user-info.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostEntity, PostLikeEntity, UserInfoEntity]),
    ExportUserInfoModule,
  ],
  controllers: [PostController],
  providers: [PostService, PostLikeService, PostRepository, PostLikeRepository],
})
export class BlogModule {}
