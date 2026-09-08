import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Stock } from '../stocks/entities/stock.entity';
import { NotificationModule } from '../notification/notification.module';
import { CommunityController } from './controllers/community.controller';
import { CommunityComment } from './entities/community-comment.entity';
import { CommunityPostLike } from './entities/community-post-like.entity';
import { CommunityPost } from './entities/community-post.entity';
import { CommunityService } from './services/community.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommunityPost,
      CommunityComment,
      CommunityPostLike,
      Stock,
    ]),
    NotificationModule,
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
