import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('quiz_categories')
export class QuizCategory {
  @PrimaryGeneratedColumn()
  category_id: number;

  @Column()
  investment_level_id: number;

  @Column()
  category_code: string;

  @Column()
  category_name: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('text', { nullable: true })
  problem_direction: string | null;

  @Column()
  sort_order: number;

  @Column()
  status: string;
}
