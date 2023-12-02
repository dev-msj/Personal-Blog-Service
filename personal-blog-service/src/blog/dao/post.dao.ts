import { AES } from 'crypto-js';
import { PostDto } from '../dto/post.dto';
import { PostInterface } from '../dto/interface/post.inteface';
import { CryptoUtils } from '../../utils/crypto.utils';

export class PostDao {
  private postUid: string;
  private postId: number;
  private title: string;
  private writeDatetime: Date;
  private contents: string;
  private hits: number;
  private postLikeUidList: string[];

  static from(postInterface: PostInterface): PostDao {
    const postDao = new PostDao();
    postDao.postUid = postInterface.postUid;
    postDao.postId = postInterface.postId;
    postDao.title = postInterface.title;
    postDao.writeDatetime = postInterface.writeDatetime;
    postDao.contents = postInterface.contents;
    postDao.hits = postInterface.hits;

    return postDao;
  }

  get getPostUid() {
    return this.postUid;
  }

  get getPostId() {
    return this.postId;
  }

  set setPostLikeUidList(postLikeUidList: string[]) {
    this.postLikeUidList = postLikeUidList;
  }

  toPostDto(pkSecretKey: string): PostDto {
    return new PostDto(
      CryptoUtils.encryptPostPK(this.postUid, pkSecretKey),
      CryptoUtils.encryptPostPK(this.postId.toString(), pkSecretKey),
      this.title,
      this.writeDatetime,
      this.contents,
      this.hits,
      this.postLikeUidList,
    );
  }
}
