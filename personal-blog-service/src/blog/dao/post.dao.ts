import { PostDto } from '../dto/post.dto';
import { PostEntity } from '../entities/post.entity';

export class PostDao {
  private postUid: string;
  private postId: number;
  private title: string;
  private wrtieDatetime: Date;
  private contents: string;
  private hits: number;
  private postLikeUidList: string[];

  static fromPostEntity(postEntity: PostEntity): PostDao {
    const postDao = new PostDao();
    postDao.postUid = postEntity.postUid;
    postDao.postId = postEntity.postId;
    postDao.title = postEntity.title;
    postDao.wrtieDatetime = postEntity.wrtieDatetime;
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

  toPostDto(): PostDto {
    return {
      postUid: this.postUid,
      postId: this.postId,
      title: this.title,
      wrtieDatetime: this.wrtieDatetime,
      contents: this.contents,
      hits: this.hits,
      postLikeUidList: this.postLikeUidList,
    } as PostDto;
  }
}
