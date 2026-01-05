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
  postId: number;

  @PrimaryColumn({ name: 'UID', length: 100 })
  uid: string;

  @CreateDateColumn({
    name: 'CREATE_DATETIME',
    type: 'datetime',
  })
  createDatetime: Date;

  @UpdateDateColumn({
    name: 'MODIFY_DATETIME',
    type: 'datetime',
  })
  modifyDatetime: Date;

  @ManyToOne(() => PostEntity, (postEntity) => postEntity.postId)
  @JoinColumn({ name: 'POST_ID', referencedColumnName: 'postId' })
  postEntity: PostEntity;

  @ManyToOne(() => UserAuthEntity, (userAuthEntity) => userAuthEntity.uid)
  @JoinColumn({ name: 'UID', referencedColumnName: 'uid' })
  userAuthEntity: UserAuthEntity;

  constructor(postId: number, uid: string) {
    this.postId = postId;
    this.uid = uid;
  }
}
