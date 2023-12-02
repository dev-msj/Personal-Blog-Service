import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('USER_INFO')
@Unique(['nickname'])
export class UserInfoEntity {
  @PrimaryColumn({ name: 'UID', length: 100 })
  readonly uid: string;

  @Column({ name: 'NICKNAME', length: 100 })
  readonly nickname: string;

  @Column({ name: 'INTRODUCE', length: 500 })
  readonly introduce: string;

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
}
