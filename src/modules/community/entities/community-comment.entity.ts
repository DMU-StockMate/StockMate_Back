import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import {
  CommunityContentStatus,
  CommunityPost,
} from './community-post.entity';

@Entity('community_comments')
@Index('idx_community_comments_post_status_created', [
  'postId',
  'status',
  'createdAt',
])
@Index('idx_community_comments_user', ['userId'])
export class CommunityComment {
  @PrimaryGeneratedColumn({ name: 'comment_id' })
  commentId: number;

  @Column({ name: 'post_id', type: 'int' })
  postId: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ type: 'text' })
  content: string;

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

  @ManyToOne(() => CommunityPost, (post) => post.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'post_id' })
  post: CommunityPost;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
