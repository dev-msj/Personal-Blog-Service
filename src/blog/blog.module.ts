import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostEntity } from './entities/post.entity';
import { PostController } from './controller/post.controller';
import { PostService } from './service/post.service';
import { PostLikeEntity } from './entities/post-like.entity';
import { PostLikeService } from './service/post-like.service';
import { PostLikeController } from './controller/post-like.controller';
import { UserInfoEntity } from '../user/entities/user-info.entity';
import { PostRepository } from './repository/post.repository';
import { PostLikeRepository } from './repository/post-like.repository';
import { UserInfoRepository } from '../user/repository/user-info.repository';
import { UserInfoService } from '../user/service/user-info.service';
import { DecryptPrimaryKeyPipe } from '../pipe/decrypt-primary-key.pipe';
import { EncryptPrimaryKeyInterceptor } from '../interceptor/encrypt-primary-key.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostEntity, PostLikeEntity, UserInfoEntity]),
  ],
  controllers: [PostController, PostLikeController],
  providers: [
    PostService,
    PostLikeService,
    PostRepository,
    PostLikeRepository,
    UserInfoService,
    UserInfoRepository,
    DecryptPrimaryKeyPipe,
    EncryptPrimaryKeyInterceptor,
  ],
})
export class BlogModule {}
