import { PostLikeDto } from '../dto/post-like.dto';
import { PostLikeEntity } from '../entities/post-like.entity';

export class PostLikeDao {
  private postUid: string;
  private postId: number;
  private uid: string;

  static fromPostLikeEntity(postLikeEntity: PostLikeEntity): PostLikeDao {
    const postLikeDao = new PostLikeDao();
    postLikeDao.postUid = postLikeEntity.postUid;
    postLikeDao.postId = postLikeEntity.postId;
    postLikeDao.uid = postLikeEntity.uid;

    return postLikeDao;
  }

  toPostLikeDto(): PostLikeDto {
    return {
      postUid: this.postUid,
      postId: this.postId,
      uid: this.uid,
    } as PostLikeDto;
  }
}
