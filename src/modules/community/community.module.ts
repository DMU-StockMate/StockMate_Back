import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CommunityController } from './controllers/community.controller';
import { CommunityService } from './services/community.service';

import { CommunityPost } from './entities/community-post.entity';
import { CommunityComment } from './entities/community-comment.entity';
import { CommunityPostLike } from './entities/community-post-like.entity';
import { Stock } from 'src/modules/stocks/entities/stock.entity';
import { User } from 'src/modules/users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommunityPost, CommunityComment, CommunityPostLike, Stock, User]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
