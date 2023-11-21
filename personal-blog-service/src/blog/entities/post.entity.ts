import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('POST')
export class PostEntity {
  @PrimaryColumn({ name: 'POST_UID', length: 100 })
  readonly postUid: string;

  @PrimaryColumn({ name: 'POST_ID' })
  readonly postId: number;

  @Column({ name: 'WRITE_DATE', type: 'datetime' })
  readonly wrtieDate: Date;

  @Column({ name: 'CONTENTS', type: 'text' })
  readonly contents: string;

  @Column({ name: 'HITS' })
  readonly hits: number;
}
