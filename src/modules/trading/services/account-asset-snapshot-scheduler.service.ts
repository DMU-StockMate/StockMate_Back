import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountAssetSnapshot } from '../entities/account-asset-snapshot.entity';

const KST_TIME_ZONE = 'Asia/Seoul';

@Injectable()
export class AccountAssetSnapshotSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    AccountAssetSnapshotSchedulerService.name,
  );
  private timer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    @InjectRepository(AccountAssetSnapshot)
    private readonly snapshotRepository: Repository<AccountAssetSnapshot>,
  ) {}

  onModuleInit() {
    void this.takeSnapshot();
    this.scheduleNextMidnightSnapshot();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  private scheduleNextMidnightSnapshot() {
    const delay = this.getMillisecondsUntilNextKstMidnight();

    this.logger.log(
      `다음 자산 스냅샷 자동 기록 예약: ${Math.round(delay / 1000)}초 후`,
    );

    this.timer = setTimeout(() => {
      void this.runAndReschedule();
    }, delay);
  }

  private async runAndReschedule() {
    try {
      await this.takeSnapshot();
    } finally {
      this.scheduleNextMidnightSnapshot();
    }
  }

  async takeSnapshot() {
    if (this.isRunning) {
      this.logger.warn('자산 스냅샷 기록이 이미 실행 중입니다.');
      return;
    }

    this.isRunning = true;

    try {
      // 계좌별 현금 + (보유 수량 × 최신 종가)를 오늘 날짜로 upsert한다.
      // 보유 종목이 없는 계좌도 현금만으로 스냅샷을 남기도록 LEFT JOIN을 사용한다.
      const result = await this.snapshotRepository.query(
        `INSERT INTO account_asset_snapshots
          (account_id, snapshot_date, cash_balance, stock_value, total_asset_value)
        SELECT
          a.account_id,
          CURDATE(),
          a.cash_balance,
          COALESCE(hv.stock_value, 0),
          a.cash_balance + COALESCE(hv.stock_value, 0)
        FROM simulation_accounts a
        LEFT JOIN (
          SELECT h.account_id, SUM(h.quantity * latest.close_price) AS stock_value
          FROM portfolio_holdings h
          INNER JOIN stock_price_daily latest
            ON latest.stock_id = h.stock_id
            AND latest.trade_date = (
              SELECT MAX(lp.trade_date)
              FROM stock_price_daily lp
              WHERE lp.stock_id = h.stock_id
            )
          GROUP BY h.account_id
        ) hv ON hv.account_id = a.account_id
        ON DUPLICATE KEY UPDATE
          cash_balance = VALUES(cash_balance),
          stock_value = VALUES(stock_value),
          total_asset_value = VALUES(total_asset_value)`,
      );

      this.logger.log(
        `자산 스냅샷 기록 완료: ${JSON.stringify(result?.affectedRows ?? result)}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '자산 스냅샷 기록 중 오류가 발생했습니다.';

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
