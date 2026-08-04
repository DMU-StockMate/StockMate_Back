import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { RiskType } from 'src/modules/enums/risk-type.enum';

export interface InvestmentProfileAnswer {
  questionCode: string;
  optionCode: string;
}

@Entity('investment_profiles')
export class InvestmentProfile {
  @PrimaryColumn({ type: 'int', name: 'user_id' })
  user_id: number;

  @Column({ type: 'int', name: 'risk_score' })
  risk_score: number;

  @Column({ type: 'enum', enum: RiskType, name: 'risk_type' })
  risk_type: RiskType;

  @Column({ type: 'int', name: 'knowledge_score' })
  knowledge_score: number;

  @Column({ type: 'int', name: 'recommended_level_id' })
  recommended_level_id: number;

  @Column({ type: 'json' })
  answers: InvestmentProfileAnswer[];

  @Column({ type: 'varchar', length: 10, name: 'profile_version' })
  profile_version: string;

  @Column({ type: 'timestamp', name: 'diagnosed_at' })
  diagnosed_at: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
