import { Entity, PrimaryColumn } from 'typeorm';

@Entity('POST_LIKE')
export class PostLikeEntity {
  @PrimaryColumn({ name: 'UID', length: 100 })
  readonly uid: string;

  @PrimaryColumn({ name: 'POST_UID', length: 100 })
  readonly postUid: string;

  @PrimaryColumn({ name: 'POST_ID' })
  readonly postId: number;
}
