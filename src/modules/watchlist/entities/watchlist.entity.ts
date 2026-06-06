import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Stock } from '../../stocks/entities/stock.entity';
import { User } from '../../users/entities/user.entity';

@Entity('watchlists')
@Unique('uk_watchlists_user_stock', ['userId', 'stockId'])
@Index('idx_watchlists_user_id', ['userId'])
@Index('idx_watchlists_stock_id', ['stockId'])
export class Watchlist {
  @PrimaryGeneratedColumn({
    name: 'watchlist_id',
    type: 'bigint',
    unsigned: true,
  })
  watchlistId!: string;

  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @Column({ name: 'stock_id', type: 'int' })
  stockId!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Stock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock!: Stock;
}
