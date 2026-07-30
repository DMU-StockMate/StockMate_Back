import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('community_post_likes')
export class CommunityPostLike {
  @PrimaryColumn({ name: 'post_id' })
  post_id: number;

  @PrimaryColumn({ name: 'user_id' })
  user_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
