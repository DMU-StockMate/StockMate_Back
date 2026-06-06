import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Stock } from '../../stocks/entities/stock.entity';
import { TradingAccount } from './trading-account.entity';

export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL',
}

@Entity('simulated_trades')
@Index('idx_trade_date', ['tradedAt'])
export class Trade {
  @PrimaryGeneratedColumn({ name: 'trade_id', type: 'bigint' })
  tradeId!: string;

  @Column({ name: 'account_id', type: 'int' })
  accountId!: number;

  @Column({ name: 'stock_id', type: 'int' })
  stockId!: number;

  @Column({
    name: 'trade_type',
    type: 'enum',
    enum: TradeType,
  })
  tradeType!: TradeType;

  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  unitPrice!: string;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  totalAmount!: string;

  @CreateDateColumn({
    name: 'traded_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  tradedAt!: Date;

  @ManyToOne(() => TradingAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: TradingAccount;

  @ManyToOne(() => Stock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock!: Stock;
}
