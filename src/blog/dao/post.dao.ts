import { PostDto } from '../dto/post.dto';
import { PostInterface } from '../dto/interface/post.inteface';

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

  toPostDto(): PostDto {
    return new PostDto(
      this.postId,
      this.postUid,
      this.title,
      this.writeDatetime,
      this.contents,
      this.hits,
      this.postLikeNicknameList,
    );
  }
}
