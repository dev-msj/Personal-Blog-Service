import {
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user')
export class UserEntity {
  // bigint는 TypeORM에서 정밀도 손실 방지를 위해 JS string으로 매핑된다.
  @PrimaryGeneratedColumn('increment', { name: 'user_id', type: 'bigint' })
  userId: string;

  @CreateDateColumn({
    name: 'created_datetime',
    type: 'datetime',
    precision: 3,
  })
  createdDatetime: Date;

  @UpdateDateColumn({
    name: 'modified_datetime',
    type: 'datetime',
    precision: 3,
  })
  modifiedDatetime: Date;
}
