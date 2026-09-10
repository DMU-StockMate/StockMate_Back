import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { KrxClient } from '../src/modules/krx/clients/krx.client';
import { KrxService } from '../src/modules/krx/services/krx.service';
import { Stock } from '../src/modules/stocks/entities/stock.entity';
import { StockDetail } from '../src/modules/stocks/entities/stock-detail.entity';
import { StockInvestmentIndicator } from '../src/modules/stocks/entities/stock-investment-indicator.entity';
import { StockPriceDaily } from '../src/modules/stocks/entities/stock-price-daily.entity';

// 스케줄러(KrxDailyPriceSchedulerService)는 제외하고 백필에 필요한 것만 모은 임시 모듈
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [Stock, StockDetail, StockInvestmentIndicator, StockPriceDaily],
        synchronize: false,
        logging: false,
      }),
    }),
    TypeOrmModule.forFeature([Stock, StockDetail, StockInvestmentIndicator, StockPriceDaily]),
  ],
  providers: [KrxClient, KrxService],
})
class BackfillModule {}

const CHUNK_DAYS = 90;
// 한 번 실행에 쓸 수 있는 최대 시간 — 넘으면 체크포인트 저장하고 깔끔하게 종료 (외부 프로세스 kill 방지)
const TIME_BUDGET_MS = 8 * 60 * 1000;
const STATE_FILE = join(__dirname, '../logs/krx-backfill-state.json');

const format_local_date = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const add_days = (dateStr: string, days: number) => {
  const date = new Date(`${dateStr}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return format_local_date(date);
};

// KrxService.syncDailyPrices(startDate, endDate)로 호출하면 항상 이 형태로 반환됨
// (date 없이 range로만 호출하는 이 스크립트 한정 — 반대 분기 결과 타입은 관련 없음)
interface DateRangeSyncResult {
  syncedDays: number;
  skippedDays: number;
  failedDays: number;
}

interface BackfillState {
  nextStart: string;
  totalSynced: number;
  totalSkipped: number;
  totalFailed: number;
}

const load_state = (defaultStart: string): BackfillState => {
  if (!existsSync(STATE_FILE)) {
    return { nextStart: defaultStart, totalSynced: 0, totalSkipped: 0, totalFailed: 0 };
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
};

const save_state = (state: BackfillState) => {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
};

async function bootstrap() {
  const startedAt = Date.now();
  const app = await NestFactory.createApplicationContext(BackfillModule, {
    logger: ['error', 'warn'],
  });

  const krxService = app.get(KrxService);
  const stockDetailRepository = app.get<Repository<StockDetail>>(
    getRepositoryToken(StockDetail),
  );

  const minRow = await stockDetailRepository
    .createQueryBuilder('detail')
    .select("DATE_FORMAT(MIN(detail.listingDate), '%Y-%m-%d')", 'min')
    .where('detail.listingDate IS NOT NULL')
    .getRawOne<{ min: string | null }>();
  const min = minRow?.min ?? null;

  // KRX Open API(data-dbg.krx.co.kr) 실측 결과 2009-11-02는 데이터 없음, 2010-01-04부터 존재.
  // 그 이전 날짜는 빠른 에러 대신 요청마다 타임아웃까지 걸려 사실상 무한정 느려지므로
  // 상장일이 더 오래됐어도 실제 API 지원 시작일로 하한을 맞춘다.
  const API_DATA_FLOOR = '2010-01-04';
  const overallStart = min && min > API_DATA_FLOOR ? min : API_DATA_FLOOR;
  const yesterday = add_days(format_local_date(new Date()), -1);

  const state = load_state(overallStart);

  console.log(
    `백필 범위: ${overallStart} ~ ${yesterday} / 이어서 시작: ${state.nextStart}`,
  );

  while (state.nextStart <= yesterday) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      console.log(`시간 예산 소진 — 체크포인트(${state.nextStart})에서 중단, 다음 실행에서 이어서 진행`);
      break;
    }

    const chunkEnd = add_days(state.nextStart, CHUNK_DAYS - 1) > yesterday
      ? yesterday
      : add_days(state.nextStart, CHUNK_DAYS - 1);

    console.log(`[chunk] ${state.nextStart} ~ ${chunkEnd} 수집 중...`);

    try {
      const result = (await krxService.syncDailyPrices({
        startDate: state.nextStart,
        endDate: chunkEnd,
      })) as DateRangeSyncResult;
      state.totalSynced += result.syncedDays;
      state.totalSkipped += result.skippedDays;
      state.totalFailed += result.failedDays;
      console.log(
        `[chunk] ${state.nextStart} ~ ${chunkEnd} 완료: synced=${result.syncedDays} skipped=${result.skippedDays} failed=${result.failedDays}`,
      );
    } catch (error) {
      console.error(`[chunk] ${state.nextStart} ~ ${chunkEnd} 실패:`, error);
    }

    state.nextStart = add_days(chunkEnd, 1);
    save_state(state);
  }

  if (state.nextStart > yesterday) {
    console.log(
      `백필 전체 완료: totalSynced=${state.totalSynced} totalSkipped=${state.totalSkipped} totalFailed=${state.totalFailed}`,
    );
  }

  await app.close();
}

bootstrap().catch((error) => {
  console.error('백필 스크립트 실행 중 오류:', error);
  process.exit(1);
});
