import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('learning_topics')
export class TopicName {
  @PrimaryGeneratedColumn({ name: 'topic_id' })
  topicId: number;

  @Column({
    name: 'topic_name',
    type: 'varchar',
    length: 100,
  })
  topicName: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string | null;
}