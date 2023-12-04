import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PostEntity } from './post.entity';
import { UserAuthEntity } from '../../user/entities/user-auth.entity';

@Entity('POST_LIKE')
export class PostLikeEntity {
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

  @ManyToOne(() => PostEntity, (postEntity) => postEntity.postId)
  @JoinColumn({ name: 'POST_ID', referencedColumnName: 'postId' })
  readonly postEntity: PostEntity;

  @ManyToOne(() => UserAuthEntity, (userAuthEntity) => userAuthEntity.uid)
  @JoinColumn({ name: 'UID', referencedColumnName: 'uid' })
  readonly userAuthEntity: UserAuthEntity;

  constructor(postId: number, uid: string) {
    this.postId = postId;
    this.uid = uid;
  }
}
