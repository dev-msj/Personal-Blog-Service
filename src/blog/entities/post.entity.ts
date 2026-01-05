import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PostLikeEntity } from './post-like.entity';
import { UserAuthEntity } from '../../user/entities/user-auth.entity';

@Entity('POST')
export class PostEntity {
  @PrimaryGeneratedColumn('increment', { name: 'POST_ID' })
  postId: number;

  @Index()
  @Column({ name: 'POST_UID', length: 100 })
  postUid: string;

  @Column({ name: 'TITLE', length: 500 })
  title: string;

  @CreateDateColumn({ name: 'WRITE_DATETIME', type: 'datetime' })
  writeDatetime: Date;

  @Column({ name: 'CONTENTS', type: 'text' })
  contents: string;

  @Column({ name: 'HITS', default: 0 })
  hits: number;

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

  @OneToMany(
    () => PostLikeEntity,
    (postLikeEntity) => postLikeEntity.postEntity,
    { onDelete: 'CASCADE' },
  )
  postLikeEntitys: PostLikeEntity[];

  @ManyToOne(() => UserAuthEntity, (userAuthEntity) => userAuthEntity.uid)
  @JoinColumn({ name: 'POST_UID', referencedColumnName: 'uid' })
  userAuthEntity: UserAuthEntity;

  constructor(
    postId: number,
    postUid: string,
    title: string,
    writeDatetime: Date,
    contents: string,
    hits: number,
  ) {
    this.postId = postId;
    this.postUid = postUid;
    this.title = title;
    this.writeDatetime = writeDatetime;
    this.contents = contents;
    this.hits = hits;
  }
}
