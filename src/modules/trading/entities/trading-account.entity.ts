import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('simulation_accounts')
@Index('idx_account_user', ['userId'])
export class TradingAccount {
  @PrimaryGeneratedColumn({ name: 'account_id', type: 'int' })
  accountId!: number;

  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @Column({
    name: 'seed_money',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  seedMoney!: string;

  @Column({
    name: 'cash_balance',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  cashBalance!: string;

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

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;
}
