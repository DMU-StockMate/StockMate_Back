import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Stock } from '../../stocks/entities/stock.entity';
import { TradingAccount } from './trading-account.entity';

@Entity('portfolio_holdings')
@Unique('account_id', ['accountId', 'stockId'])
export class Holding {
  @PrimaryGeneratedColumn({ name: 'holding_id', type: 'bigint' })
  holdingId!: string;

  @Column({ name: 'account_id', type: 'int' })
  accountId!: number;

  @Column({ name: 'stock_id', type: 'int' })
  stockId!: number;

  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;

  @Column({
    name: 'avg_buy_price',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  avgBuyPrice!: string;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  @ManyToOne(() => TradingAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: TradingAccount;

  @ManyToOne(() => Stock, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock!: Stock;
}
