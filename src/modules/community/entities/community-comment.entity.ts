import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { CommunityPost } from './community-post.entity';
import { ContentStatus } from 'src/modules/enums/content-status.enum';

@Entity('community_comments')
export class CommunityComment {
  @PrimaryGeneratedColumn({ name: 'comment_id' })
  comment_id: number;

  @Column({ name: 'post_id' })
  post_id: number;

  @ManyToOne(() => CommunityPost)
  @JoinColumn({ name: 'post_id' })
  post: CommunityPost;

  @Column({ name: 'user_id' })
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('text')
  content: string;

  @Column({ type: 'enum', enum: ContentStatus, default: ContentStatus.ACTIVE })
  status: ContentStatus;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deleted_at: Date | null;
}
