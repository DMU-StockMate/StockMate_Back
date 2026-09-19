import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Stock } from '../../stocks/entities/stock.entity';
import { TradingVenue } from './investment-order.entity';

@Entity('stock_trading_venues')
export class StockTradingVenue {
  @PrimaryColumn({ name: 'stock_id', type: 'int' })
  stockId!: number;

  @PrimaryColumn({ name: 'trading_venue', type: 'varchar', length: 20 })
  tradingVenue!: TradingVenue;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne(() => Stock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock!: Stock;
}
