import { PostDto } from '../dto/post.dto';
import { PostEntity } from '../entities/post.entity';
import { PostLikeDao } from './post-like.dao';

export class PostDao {
  private postUid: string;
  private postId: number;
  private title: string;
  private wrtieDatetime: Date;
  private contents: string;
  private hits: number;
  private PostLikeDaos: PostLikeDao[];

  static fromPostEntity(postEntity: PostEntity): PostDao {
    const postDao = new PostDao();
    postDao.postUid = postEntity.postUid;
    postDao.postId = postEntity.postId;
    postDao.title = postEntity.title;
    postDao.wrtieDatetime = postEntity.wrtieDatetime;
    postDao.contents = postEntity.contents;
    postDao.hits = postEntity.hits;
    postDao.PostLikeDaos = postEntity.postLikeEntitys.map((postLikeEntity) =>
      PostLikeDao.fromPostLikeEntity(postLikeEntity),
    );

    return postDao;
  }

  toPostDto(): PostDto {
    return {
      postUid: this.postUid,
      postId: this.postId,
      title: this.title,
      wrtieDatetime: this.wrtieDatetime,
      contents: this.contents,
      hits: this.hits,
      postLikeDtos: this.PostLikeDaos.map((postLikeDao) =>
        postLikeDao.toPostLikeDto(),
      ),
    } as PostDto;
  }
}
