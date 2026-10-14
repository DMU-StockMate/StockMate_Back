import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TradingAccount } from './trading-account.entity';

export enum CashHistoryType {
  REWARD = 'REWARD',
  BUY = 'BUY',
  SELL = 'SELL',
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
}

@Entity('account_cash_histories')
@Index('idx_cash_history_type', ['historyType'])
@Index('idx_cash_history_account_ref', [
  'accountId',
  'historyType',
  'refType',
  'refId',
])
export class AccountCashHistory {
  @PrimaryGeneratedColumn({ name: 'cash_history_id', type: 'bigint' })
  cashHistoryId!: string;

  @Column({ name: 'account_id', type: 'int' })
  accountId!: number;

  @Column({
    name: 'history_type',
    type: 'enum',
    enum: CashHistoryType,
  })
  historyType!: CashHistoryType;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  amount!: string;

  @Column({
    name: 'balance_after',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  balanceAfter!: string;

  @Column({ name: 'ref_type', type: 'varchar', length: 50, nullable: true })
  refType?: string | null;

  @Column({ name: 'ref_id', type: 'bigint', nullable: true })
  refId?: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne(() => TradingAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: TradingAccount;
}
