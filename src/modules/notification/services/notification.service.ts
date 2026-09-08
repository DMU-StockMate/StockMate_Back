import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FindNotificationQueryDto } from '../dto/find-notification-query.dto';
import { Notification, NotificationType } from '../entities/notification.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  // 알림 생성 실패로 매수/매도, 댓글 등 핵심 동작이 실패하면 안 되므로 에러를 삼킨다.
  async create(
    userId: number,
    type: NotificationType,
    title: string,
    message: string,
    link: string | null = null,
  ) {
    try {
      return await this.notificationRepository.save(
        this.notificationRepository.create({ userId, type, title, message, link }),
      );
    } catch (error) {
      this.logger.error(`알림 생성 실패 (userId=${userId}, type=${type})`, error);
      return null;
    }
  }

  async findMine(userId: number, query: FindNotificationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  countUnread(userId: number) {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(userId: number, notificationId: number) {
    const notification = await this.notificationRepository.findOne({
      where: { notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('알림을 찾을 수 없습니다.');
    }

    notification.isRead = true;
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: number) {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );

    return { message: '모든 알림을 읽음 처리했습니다.' };
  }
}
