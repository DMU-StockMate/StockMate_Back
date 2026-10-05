import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Stock } from '../../stocks/entities/stock.entity';
import { TradingAccount } from './trading-account.entity';

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP_LIMIT = 'STOP_LIMIT',
  RESERVATION = 'RESERVATION',
  CONDITIONAL_LIMIT = 'CONDITIONAL_LIMIT',
  AFTER_HOURS_CLOSE = 'AFTER_HOURS_CLOSE',
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export enum TradingVenue {
  KRX = 'KRX',
  NXT = 'NXT',
}

@Entity('investment_orders')
@Index('idx_investment_orders_account_status', ['accountId', 'status'])
@Index('idx_investment_orders_stock_status_type', [
  'stockId',
  'status',
  'orderType',
])
@Index('idx_investment_orders_status_type_stock', [
  'status',
  'orderType',
  'stockId',
])
export class InvestmentOrder {
  @PrimaryGeneratedColumn({ name: 'order_id', type: 'bigint' })
  orderId!: string;

  @Column({ name: 'account_id', type: 'int' })
  accountId!: number;

  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @Column({ name: 'stock_id', type: 'int' })
  stockId!: number;

  @Column({ name: 'stock_code', type: 'varchar', length: 20 })
  stockCode!: string;

  @Column({
    name: 'trading_venue',
    type: 'varchar',
    length: 20,
    default: TradingVenue.KRX,
  })
  tradingVenue!: TradingVenue;

  @Column({ name: 'side', type: 'enum', enum: OrderSide })
  side!: OrderSide;

  @Column({ name: 'order_type', type: 'enum', enum: OrderType })
  orderType!: OrderType;

  @Column({ name: 'status', type: 'enum', enum: OrderStatus })
  status!: OrderStatus;

  @Column({ name: 'quantity', type: 'int' })
  quantity!: number;

  @Column({
    name: 'limit_price',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  limitPrice!: string | null;

  @Column({
    name: 'stop_price',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  stopPrice!: string | null;

  @Column({
    name: 'execution_order_type',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  executionOrderType!: OrderType | null;

  @Column({
    name: 'reserved_amount',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
  })
  reservedAmount!: string;

  @Column({
    name: 'execution_price',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  executionPrice!: string | null;

  @Column({ name: 'filled_at', type: 'datetime', nullable: true })
  filledAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'scheduled_at', type: 'datetime', nullable: true })
  scheduledAt!: Date | null;

  @Column({ name: 'triggered_at', type: 'datetime', nullable: true })
  triggeredAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

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
