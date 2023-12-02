import { AES } from 'crypto-js';
import { PostDto } from '../dto/post.dto';
import { PostEntity } from '../entities/post.entity';

export class PostDao {
  private postUid: string;
  private postId: number;
  private title: string;
  private writeDatetime: Date;
  private contents: string;
  private hits: number;
  private postLikeUidList: string[];

  static fromPostEntity(postEntity: PostEntity): PostDao {
    const postDao = new PostDao();
    postDao.postUid = postEntity.postUid;
    postDao.postId = postEntity.postId;
    postDao.title = postEntity.title;
    postDao.writeDatetime = postEntity.writeDatetime;
    postDao.contents = postEntity.contents;
    postDao.hits = postEntity.hits;

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
      encodeURIComponent(AES.encrypt(this.postUid, pkSecretKey).toString()),
      encodeURIComponent(
        AES.encrypt(this.postId.toString(), pkSecretKey).toString(),
      ),
      this.title,
      this.writeDatetime,
      this.contents,
      this.hits,
      this.postLikeUidList,
    );
  }
}
