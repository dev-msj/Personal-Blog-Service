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
  private postLikeNicknameList: string[];

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

  set setPostLikeNicknameList(postLikeNicknameList: string[]) {
    this.postLikeNicknameList = postLikeNicknameList;
  }

  toPostDto(pkSecretKey: string): PostDto {
    return new PostDto(
      CryptoUtils.encryptPrimaryKey(this.postId.toString(), pkSecretKey),
      CryptoUtils.encryptPrimaryKey(this.postUid, pkSecretKey),
      this.title,
      this.writeDatetime,
      this.contents,
      this.hits,
      this.postLikeNicknameList,
    );
  }
}
