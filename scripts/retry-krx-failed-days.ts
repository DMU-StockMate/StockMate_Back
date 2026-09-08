import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { KrxClient } from '../src/modules/krx/clients/krx.client';
import { KrxService } from '../src/modules/krx/services/krx.service';
import { Stock } from '../src/modules/stocks/entities/stock.entity';
import { StockDetail } from '../src/modules/stocks/entities/stock-detail.entity';
import { StockInvestmentIndicator } from '../src/modules/stocks/entities/stock-investment-indicator.entity';
import { StockPriceDaily } from '../src/modules/stocks/entities/stock-price-daily.entity';

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
class RetryModule {}

const TIME_BUDGET_MS = 8 * 60 * 1000;
const BACKFILL_LOG = join(__dirname, '../logs/krx-backfill.log');
const STATE_FILE = join(__dirname, '../logs/krx-retry-state.json');

interface RetryState {
  dates: string[]; // YYYY-MM-DD, 정렬됨
  index: number;
  synced: number;
  skipped: number;
  stillFailed: string[];
}

// backfill 로그에서 네트워크 오류 등으로 실패했던 날짜(basDd)를 모두 추출해 중복 제거
const extract_failed_dates = (): string[] => {
  const log = readFileSync(BACKFILL_LOG, 'utf8');
  const matches = log.matchAll(/basDd: '(\d{8})'/g);
  const dates = new Set<string>();
  for (const [, basDd] of matches) {
    dates.add(`${basDd.slice(0, 4)}-${basDd.slice(4, 6)}-${basDd.slice(6, 8)}`);
  }
  return [...dates].sort();
};

const load_state = (): RetryState => {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  }
  return { dates: extract_failed_dates(), index: 0, synced: 0, skipped: 0, stillFailed: [] };
};

const save_state = (state: RetryState) => {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
};

async function bootstrap() {
  const startedAt = Date.now();
  const app = await NestFactory.createApplicationContext(RetryModule, {
    logger: ['error', 'warn'],
  });
  const krxService = app.get(KrxService);

  const state = load_state();
  console.log(`재시도 대상: 총 ${state.dates.length}일 중 ${state.index}번째부터 이어서`);

  while (state.index < state.dates.length) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      console.log(`시간 예산 소진 — index ${state.index}에서 중단, 다음 실행에서 이어서 진행`);
      break;
    }

    const date = state.dates[state.index];

    try {
      await krxService.syncDailyPrices({ date });
      state.synced++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('일별 시세가 없습니다')) {
        state.skipped++;
      } else {
        state.stillFailed.push(date);
        console.error(`[retry-fail] ${date}: ${message}`);
      }
    }

    state.index++;
    if (state.index % 50 === 0) {
      console.log(`진행: ${state.index}/${state.dates.length} (synced=${state.synced} skipped=${state.skipped} stillFailed=${state.stillFailed.length})`);
      save_state(state);
    }
  }

  save_state(state);

  if (state.index >= state.dates.length) {
    console.log(
      `재시도 전체 완료: synced=${state.synced} skipped=${state.skipped} stillFailed=${state.stillFailed.length}`,
    );
    if (state.stillFailed.length > 0) {
      console.log('여전히 실패한 날짜:', state.stillFailed.join(', '));
    }
  }

  await app.close();
}

bootstrap().catch((error) => {
  console.error('재시도 스크립트 실행 중 오류:', error);
  process.exit(1);
});
