import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Stock } from '../../stocks/entities/stock.entity';
import { User } from '../../users/entities/user.entity';
import { CommunityComment } from './community-comment.entity';
import { CommunityPostLike } from './community-post-like.entity';

export enum CommunityBoardType {
  FREE = 'FREE',
  STOCK = 'STOCK',
}

export enum CommunityContentStatus {
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
}

@Entity('community_posts')
@Index('idx_community_posts_board_status_created', [
  'boardType',
  'status',
  'createdAt',
])
@Index('idx_community_posts_stock_status_created', [
  'stockId',
  'status',
  'createdAt',
])
@Index('idx_community_posts_user', ['userId'])
export class CommunityPost {
  @PrimaryGeneratedColumn({ name: 'post_id' })
  postId: number;

  @Column({
    name: 'board_type',
    type: 'enum',
    enum: CommunityBoardType,
  })
  boardType: CommunityBoardType;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'stock_id', type: 'int', nullable: true })
  stockId: number | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @Column({ name: 'like_count', type: 'int', default: 0 })
  likeCount: number;

  @Column({ name: 'comment_count', type: 'int', default: 0 })
  commentCount: number;

  @Column({
    type: 'enum',
    enum: CommunityContentStatus,
    default: CommunityContentStatus.ACTIVE,
  })
  status: CommunityContentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Stock, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'stock_id' })
  stock: Stock | null;

  @OneToMany(() => CommunityComment, (comment) => comment.post)
  comments: CommunityComment[];

  @OneToMany(() => CommunityPostLike, (like) => like.post)
  likes: CommunityPostLike[];
}
