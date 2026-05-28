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

@Entity('stock_investment_indicators')
@Unique('uk_stock_investment_indicators_stock_date', ['stockId', 'tradeDate'])
@Index('idx_stock_investment_indicators_stock_date', ['stockId', 'tradeDate'])
export class StockInvestmentIndicator {
  @PrimaryGeneratedColumn({ name: 'indicator_id', type: 'bigint' })
  indicatorId!: string;

  @Column({ name: 'stock_id', type: 'int' })
  stockId!: number;

  @Column({ name: 'trade_date', type: 'date' })
  tradeDate!: string;

  @Column({
    name: 'per',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  per?: string | null;

  @Column({
    name: 'pbr',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  pbr?: string | null;

  @Column({
    name: 'eps',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  eps?: string | null;

  @Column({
    name: 'bps',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  bps?: string | null;

  @Column({
    name: 'roe',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  roe?: string | null;

  @Column({
    name: 'dividend_yield',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  dividendYield?: string | null;

  @Column({
    name: 'dps',
    type: 'decimal',
    precision: 18,
    scale: 4,
    nullable: true,
  })
  dps?: string | null;

  @Column({ name: 'source', type: 'varchar', length: 50, default: 'KRX' })
  source!: string;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  @ManyToOne(() => Stock, (stock) => stock.investmentIndicators, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'stock_id' })
  stock!: Stock;
}
