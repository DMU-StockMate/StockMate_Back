import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('investment_levels')
export class InvestmentLevel {
  @PrimaryGeneratedColumn({ name: 'investment_level_id' })
  investmentLevelId: number;

  @Column({
    name: 'level_name',
    type: 'varchar',
    length: 50,
  })
  levelName: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null;
}