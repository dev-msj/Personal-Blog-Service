import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PostLikeEntity } from './post-like.entity';

@Entity('POST')
export class PostEntity {
  @PrimaryColumn({ name: 'POST_UID', length: 100 })
  readonly postUid: string;

  @PrimaryColumn({ name: 'POST_ID' })
  readonly postId: number;

  @Column({ name: 'TITLE', length: 500 })
  readonly title: string;

  @CreateDateColumn({ name: 'WRITE_DATETIME', type: 'datetime' })
  readonly wrtieDatetime: Date;

  @Column({ name: 'CONTENTS', type: 'text' })
  readonly contents: string;

  @Column({ name: 'HITS' })
  readonly hits: number;

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

  @OneToMany(
    () => PostLikeEntity,
    (postLikeEntity) => postLikeEntity.postEntity,
  )
  readonly postLikeEntitys: PostLikeEntity;
}
