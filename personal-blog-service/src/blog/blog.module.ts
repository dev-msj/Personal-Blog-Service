import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostEntity } from './entities/post.entity';
import { PostController } from './controller/post.controller';
import { PostService } from './service/post.serivce';
import { PostLikeEntity } from './entities/post-like.entity';
import { PostLikeService } from './service/post-like.serivce';
import { UserInfoEntity } from 'src/user/entities/user-info.entity';
import { PostRepository } from './repository/post.repository';
import { PostLikeRepository } from './repository/post-like.repository';
import { ExportUserModule } from 'src/user/export/export-user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostEntity, PostLikeEntity, UserInfoEntity]),
    ExportUserModule,
  ],
  controllers: [PostController],
  providers: [PostService, PostLikeService, PostRepository, PostLikeRepository],
})
export class BlogModule {}
