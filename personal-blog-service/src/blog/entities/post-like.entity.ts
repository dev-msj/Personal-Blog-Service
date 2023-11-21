import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PostEntity } from './post.entity';

@Entity('POST_LIKE')
export class PostLikeEntity {
  @PrimaryColumn({ name: 'UID', length: 100 })
  readonly uid: string;

  @PrimaryColumn({ name: 'POST_UID', length: 100 })
  readonly postUid: string;

  @PrimaryColumn({ name: 'POST_ID' })
  readonly postId: number;

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
  readonly postEntity: PostEntity;
}
