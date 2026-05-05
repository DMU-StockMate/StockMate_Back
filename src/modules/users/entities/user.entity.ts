import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true, name: 'user_id' })
  user_id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  nickname: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 20, default: 'USER' })
  role: string;

  // 추가된 필드: 투자 레벨 (FK는 관계 설정 전까지는 일반 컬럼으로 정의 가능)
  @Column({ type: 'int', name: 'investment_level_id', nullable: true })
  investment_level_id: number;

  // 추가된 필드: 프로필 이미지 URL
  @Column({ type: 'varchar', length: 255, name: 'profile_image_url', nullable: true })
  profile_image_url: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ 
    name: 'updated_at', 
    type: 'timestamp', 
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP' 
  })
  updated_at: Date;
}