import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { Stock } from './stock.entity';

@Entity('stock_details')
export class StockDetail {
  @PrimaryColumn({ name: 'stock_id', type: 'int' })
  stockId!: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'ceo_name', type: 'varchar', length: 50, nullable: true })
  ceoName?: string | null;

  @Column({ name: 'industry_detail', type: 'varchar', length: 100, nullable: true })
  industryDetail?: string | null;

  @Column({ name: 'market_cap', type: 'bigint', nullable: true })
  marketCap?: string | null;

  @Column({ name: 'listing_date', type: 'date', nullable: true })
  listingDate?: string | null;

  @Column({ name: 'total_shares', type: 'bigint', nullable: true })
  totalShares?: string | null;

  @Column({ name: 'homepage_url', type: 'varchar', length: 255, nullable: true })
  homepageUrl?: string | null;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  @OneToOne(() => Stock, (stock) => stock.detail, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_id' })
  stock!: Stock;
}