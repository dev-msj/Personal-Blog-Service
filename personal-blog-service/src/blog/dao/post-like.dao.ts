import { PostLikeInteface } from '../dto/interface/post-like.interface';
import { PostLikeDto } from '../dto/post-like.dto';
import { PostLikeEntity } from '../entities/post-like.entity';

export class PostLikeDao {
  private postUid: string;
  private postId: number;
  private uid: string;

  static from(postLikeInteface: PostLikeInteface) {
    const postLikeDao = new PostLikeDao();
    postLikeDao.postUid = postLikeInteface.postUid;
    postLikeDao.postId = postLikeInteface.postId;
    postLikeDao.uid = postLikeInteface.uid;

    return postLikeDao;
  }

  get getUid() {
    return this.uid;
  }

  toPostLikeDto(): PostLikeDto {
    return new PostLikeDto(this.postUid, this.postId, this.uid);
  }

  toPostLikeEntity(): PostLikeEntity {
    return new PostLikeEntity(this.postUid, this.postId, this.uid);
  }
}
