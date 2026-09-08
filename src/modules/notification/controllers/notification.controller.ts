import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../users/guards/jwt-auth.guard';
import { FindNotificationQueryDto } from '../dto/find-notification-query.dto';
import { NotificationService } from '../services/notification.service';

@ApiTags('notifications')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: '내 알림 목록 조회' })
  findMine(@Req() req, @Query() query: FindNotificationQueryDto) {
    return this.notificationService.findMine(req.user.userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: '읽지 않은 알림 개수 조회' })
  async countUnread(@Req() req) {
    const count = await this.notificationService.countUnread(req.user.userId);
    return { count };
  }

  @Patch('read-all')
  @ApiOperation({ summary: '모든 알림 읽음 처리' })
  markAllAsRead(@Req() req) {
    return this.notificationService.markAllAsRead(req.user.userId);
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: '알림 읽음 처리' })
  markAsRead(
    @Req() req,
    @Param('notificationId', ParseIntPipe) notificationId: number,
  ) {
    return this.notificationService.markAsRead(req.user.userId, notificationId);
  }
}
