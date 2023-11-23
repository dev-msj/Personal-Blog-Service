import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostEntity } from './entities/post.entity';
import { PostController } from './controller/post.controller';
import { PostService } from './service/post.serivce';
import { PostLikeEntity } from './entities/post-like.entity';
import { PostLikeService } from './service/post-like.serivce';

@Module({
  imports: [TypeOrmModule.forFeature([PostEntity, PostLikeEntity])],
  controllers: [PostController],
  providers: [PostService, PostLikeService],
})
export class BlogModule {}
