import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Stock } from './stock.entity';

@Entity('stock_price_daily')
@Unique('uk_stock_price_daily_stock_date', ['stockId', 'tradeDate'])
@Index('idx_price_date', ['tradeDate'])
export class StockPriceDaily {
  @PrimaryGeneratedColumn({ name: 'price_id', type: 'bigint' })
  priceId!: string;

  @Column({ name: 'stock_id', type: 'int' })
  stockId!: number;

  @Column({ name: 'trade_date', type: 'date' })
  tradeDate!: string;

  @Column({
    name: 'open_price',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  openPrice?: string | null;

  @Column({
    name: 'high_price',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  highPrice?: string | null;

  @Column({
    name: 'low_price',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  lowPrice?: string | null;

  @Column({
    name: 'close_price',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  closePrice?: string | null;

  @Column({ name: 'volume', type: 'bigint', nullable: true })
  volume?: string | null;

  @ManyToOne(() => Stock, (stock) => stock.prices, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stock_id' })
  stock!: Stock;
}