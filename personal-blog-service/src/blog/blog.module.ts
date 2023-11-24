import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostEntity } from './entities/post.entity';
import { PostController } from './controller/post.controller';
import { PostService } from './service/post.serivce';
import { PostLikeEntity } from './entities/post-like.entity';
import { PostLikeService } from './service/post-like.serivce';
import { UserInfoService } from 'src/user/service/user-info.service';
import { UserInfoEntity } from 'src/user/entities/user-info.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostEntity, PostLikeEntity, UserInfoEntity]),
  ],
  controllers: [PostController],
  providers: [PostService, PostLikeService, UserInfoService],
})
export class BlogModule {}
