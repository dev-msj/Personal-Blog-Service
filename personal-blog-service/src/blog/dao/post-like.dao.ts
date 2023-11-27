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

  static fromPostLikeDto(postLikeDto: PostLikeDto): PostLikeDao {
    const postLikeDao = new PostLikeDao();
    postLikeDao.postUid = postLikeDto.postUid;
    postLikeDao.postId = postLikeDto.postId;
    postLikeDao.uid = postLikeDto.uid;

    return postLikeDao;
  }

  get getUid() {
    return this.uid;
  }

  toPostLikeEntity(): PostLikeEntity {
    return new PostLikeEntity(this.getUid, this.postId, this.uid);
  }
}
