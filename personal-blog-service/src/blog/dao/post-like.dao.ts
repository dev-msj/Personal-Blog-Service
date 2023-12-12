import { PostLikeInteface } from '../dto/interface/post-like.interface';
import { PostLikeEntity } from '../entities/post-like.entity';

export class PostLikeDao {
  private postId: number;
  private uid: string;

  static from(postLikeInteface: PostLikeInteface) {
    const postLikeDao = new PostLikeDao();
    postLikeDao.postId = postLikeInteface.postId;
    postLikeDao.uid = postLikeInteface.uid;

    return postLikeDao;
  }

  get getUid() {
    return this.uid;
  }

  toPostLikeEntity(): PostLikeEntity {
    return new PostLikeEntity(this.postId, this.uid);
  }
}
