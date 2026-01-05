import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserAuthEntity } from './user-auth.entity';

@Entity('USER_INFO')
@Unique(['nickname'])
export class UserInfoEntity {
  @PrimaryColumn({ name: 'UID', length: 100 })
  uid: string;

  @Column({ name: 'NICKNAME', length: 100 })
  nickname: string;

  @Column({ name: 'INTRODUCE', length: 500 })
  introduce: string;

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

  @OneToOne(() => UserAuthEntity, (userAuthEntity) => userAuthEntity.uid)
  @JoinColumn({ name: 'UID', referencedColumnName: 'uid' })
  userAuthEntity: UserAuthEntity;

  constructor(uid: string, nickname: string, introduce: string) {
    this.uid = uid;
    this.nickname = nickname;
    this.introduce = introduce;
  }
}
