import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { KrxService } from './krx.service';

const KST_TIME_ZONE = 'Asia/Seoul';

@Injectable()
export class KrxDailyPriceSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KrxDailyPriceSchedulerService.name);
  private timer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(private readonly krxService: KrxService) {}

  onModuleInit() {
    this.scheduleNextMidnightSync();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  private scheduleNextMidnightSync() {
    const delay = this.getMillisecondsUntilNextKstMidnight();

    this.logger.log(
      `다음 KRX 일별 시세 자동 수집 예약: ${Math.round(delay / 1000)}초 후`,
    );

    this.timer = setTimeout(() => {
      void this.runAndReschedule();
    }, delay);
  }

  private async runAndReschedule() {
    try {
      await this.syncDailyPrices();
    } finally {
      this.scheduleNextMidnightSync();
    }
  }

  private async syncDailyPrices() {
    if (this.isRunning) {
      this.logger.warn('KRX 일별 시세 자동 수집이 이미 실행 중입니다.');
      return;
    }

    this.isRunning = true;

    try {
      const result = await this.krxService.syncDailyPrices();
      this.logger.log(
        `KRX 일별 시세 자동 수집 완료: ${JSON.stringify(result)}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'KRX 일별 시세 자동 수집 중 오류가 발생했습니다.';

      this.logger.error(message, error instanceof Error ? error.stack : '');
    } finally {
      this.isRunning = false;
    }
  }

  private getMillisecondsUntilNextKstMidnight() {
    const now = Date.now();
    const kstDateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: KST_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(now));
    const nextMidnight =
      new Date(`${kstDateParts}T00:00:00+09:00`).getTime() +
      24 * 60 * 60 * 1000;

    return Math.max(nextMidnight - now, 1000);
  }
}
