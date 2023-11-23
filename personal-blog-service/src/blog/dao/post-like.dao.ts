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

  get getUid() {
    return this.uid;
  }
}
