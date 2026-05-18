import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserStatus } from 'src/modules/enums/user-status.enum'; 
import { UserRole } from 'src/modules/enums/role-enum';
@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, name: 'user_id' })
  user_id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password_hash: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  nickname: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  //enum 추천
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  //계정 상태
  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  //정지 기간
  @Column({
    type: 'datetime',
    nullable: true,
  })
  ban_until: Date | null;

  @Column({ type: 'int', name: 'investment_level_id', nullable: true })
  investment_level_id: number;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'profile_image_url',
    nullable: true,
  })
  profile_image_url: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}