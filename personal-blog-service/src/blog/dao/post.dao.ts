import { PostDto } from '../dto/post.dto';
import { PostInterface } from '../dto/interface/post.inteface';
import { CryptoUtils } from '../../utils/crypto.utils';

export class PostDao {
  private postId: number;
  private postUid: string;
  private title: string;
  private writeDatetime: Date;
  private contents: string;
  private hits: number;
  private postLikeUidList: string[];

  static from(postInterface: PostInterface): PostDao {
    const postDao = new PostDao();
    postDao.postId = postInterface.postId;
    postDao.postUid = postInterface.postUid;
    postDao.title = postInterface.title;
    postDao.writeDatetime = postInterface.writeDatetime;
    postDao.contents = postInterface.contents;
    postDao.hits = postInterface.hits;

    return postDao;
  }

  get getPostId() {
    return this.postId;
  }

  get getPostUid() {
    return this.postUid;
  }

  set setPostLikeUidList(postLikeUidList: string[]) {
    this.postLikeUidList = postLikeUidList;
  }

  toPostDto(pkSecretKey: string): PostDto {
    return new PostDto(
      CryptoUtils.encryptPostPK(this.postId.toString(), pkSecretKey),
      CryptoUtils.encryptPostPK(this.postUid, pkSecretKey),
      this.title,
      this.writeDatetime,
      this.contents,
      this.hits,
      this.postLikeUidList,
    );
  }
}
