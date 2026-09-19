import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('market_holidays')
export class MarketHoliday {
  @PrimaryColumn({ name: 'holiday_date', type: 'date' })
  holidayDate!: string;

  @PrimaryColumn({ name: 'market', type: 'varchar', length: 20 })
  market!: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}
