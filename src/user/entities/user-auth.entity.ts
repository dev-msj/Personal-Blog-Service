import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../constant/user-role.enum';
import { UserInfoEntity } from './user-info.entity';
import { PostLikeEntity } from '../../blog/entities/post-like.entity';
import { PostEntity } from '../../blog/entities/post.entity';

@Entity('USER_AUTH')
export class UserAuthEntity {
  @PrimaryColumn({ name: 'UID', length: 100 })
  uid: string;

  @Column({ name: 'PASSWORD', length: 1000 })
  password: string;

  @Column({ name: 'SALT', length: 50 })
  salt: string;

  @Column({ name: 'SOCIAL_YN', type: 'char', length: 1 })
  socialYN: string;

  @Column({ name: 'REFRESH_TOKEN', length: 500 })
  refreshToken: string;

  @Column({ name: 'USER_ROLE', type: 'enum', enum: UserRole })
  userRole: UserRole;

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

  @OneToOne(() => UserInfoEntity, (userInfoEntity) => userInfoEntity.uid, {
    onDelete: 'CASCADE',
  })
  userInfo: UserInfoEntity;

  @OneToMany(() => PostEntity, (postEntity) => postEntity.postUid, {
    onDelete: 'CASCADE',
  })
  postEntitys: PostEntity[];

  @OneToMany(() => PostLikeEntity, (postLikeEntity) => postLikeEntity.uid, {
    onDelete: 'CASCADE',
  })
  postLikeEntitys: PostLikeEntity[];

  constructor(
    uid: string,
    password: string,
    salt: string,
    socialYN: string,
    refreshToken: string,
    userRole: UserRole,
  ) {
    this.uid = uid;
    this.password = password;
    this.salt = salt;
    this.socialYN = socialYN;
    this.refreshToken = refreshToken;
    this.userRole = userRole;
  }
}
