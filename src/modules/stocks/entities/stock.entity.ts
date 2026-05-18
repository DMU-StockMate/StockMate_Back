import {
  Column,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StockDetail } from './stock-detail.entity';
import { StockPriceDaily } from './stock-price-daily.entity';

export enum StockStatus {
  ACTIVE = 'ACTIVE',
  DELISTED = 'DELISTED',
  SUSPENDED = 'SUSPENDED',
}

@Entity('stocks')
@Index('idx_stocks_company_name', ['companyName'])
@Index('idx_stocks_status', ['status'])
export class Stock {
  @PrimaryGeneratedColumn({ name: 'stock_id' })
  stockId!: number;

  @Column({ name: 'ticker', type: 'varchar', length: 20, unique: true })
  ticker!: string;

  @Column({ name: 'company_name', type: 'varchar', length: 100 })
  companyName!: string;

  @Column({ name: 'market', type: 'varchar', length: 20, nullable: true })
  market?: string;

  @Column({ name: 'sector', type: 'varchar', length: 50, nullable: true })
  sector?: string;

  @Column({ name: 'currency', type: 'varchar', length: 10, default: 'KRW' })
  currency!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: StockStatus,
    default: StockStatus.ACTIVE,
  })
  status!: StockStatus;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToOne(() => StockDetail, (detail) => detail.stock)
  detail?: StockDetail;

  @OneToMany(() => StockPriceDaily, (price) => price.stock)
  prices?: StockPriceDaily[];
}