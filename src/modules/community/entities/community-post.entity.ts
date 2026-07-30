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
import { Stock } from 'src/modules/stocks/entities/stock.entity';
import { BoardType } from 'src/modules/enums/board-type.enum';
import { ContentStatus } from 'src/modules/enums/content-status.enum';

@Entity('community_posts')
export class CommunityPost {
  @PrimaryGeneratedColumn({ name: 'post_id' })
  post_id: number;

  @Column({ type: 'enum', enum: BoardType, name: 'board_type' })
  board_type: BoardType;

  @Column({ name: 'user_id' })
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'stock_id', nullable: true })
  stock_id: number | null;

  @ManyToOne(() => Stock, { nullable: true })
  @JoinColumn({ name: 'stock_id' })
  stock: Stock | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column('text')
  content: string;

  @Column({ name: 'view_count', default: 0 })
  view_count: number;

  @Column({ name: 'like_count', default: 0 })
  like_count: number;

  @Column({ name: 'comment_count', default: 0 })
  comment_count: number;

  @Column({ type: 'enum', enum: ContentStatus, default: ContentStatus.ACTIVE })
  status: ContentStatus;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deleted_at: Date | null;
}
