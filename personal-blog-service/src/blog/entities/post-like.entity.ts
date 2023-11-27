import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PostEntity } from './post.entity';

@Entity('POST_LIKE')
export class PostLikeEntity {
  @PrimaryColumn({ name: 'POST_UID', length: 100 })
  readonly postUid: string;

  @PrimaryColumn({ name: 'POST_ID' })
  readonly postId: number;

  @PrimaryColumn({ name: 'UID', length: 100 })
  readonly uid: string;

  @CreateDateColumn({
    name: 'CREATE_DATETIME',
    type: 'datetime',
  })
  readonly createDatetime: Date;

  @UpdateDateColumn({
    name: 'MODIFY_DATETIME',
    type: 'datetime',
  })
  readonly modifyDatetime: Date;

  @ManyToOne(() => PostEntity, (postEntity) => postEntity.postLikeEntitys)
  @JoinColumn([
    { name: 'POST_UID', referencedColumnName: 'postUid' },
    { name: 'POST_ID', referencedColumnName: 'postId' },
  ])
  readonly postEntity: PostEntity;

  constructor(postUid: string, postId: number, uid: string) {
    this.postUid = postUid;
    this.postId = postId;
    this.uid = uid;
  }
}
