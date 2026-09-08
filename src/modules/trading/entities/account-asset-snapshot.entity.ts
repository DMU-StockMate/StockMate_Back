import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('account_asset_snapshots')
@Unique('uk_account_snapshot_date', ['accountId', 'snapshotDate'])
@Index('idx_account_asset_snapshots_account_date', ['accountId', 'snapshotDate'])
export class AccountAssetSnapshot {
  @PrimaryGeneratedColumn({ name: 'snapshot_id', type: 'int' })
  snapshotId!: number;

  @Column({ name: 'account_id', type: 'int' })
  accountId!: number;

  @Column({ name: 'snapshot_date', type: 'date' })
  snapshotDate!: string;

  @Column({ name: 'cash_balance', type: 'decimal', precision: 18, scale: 2 })
  cashBalance!: string;

  @Column({ name: 'stock_value', type: 'decimal', precision: 18, scale: 2 })
  stockValue!: string;

  @Column({
    name: 'total_asset_value',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  totalAssetValue!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
