import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { KrxClient } from '../clients/krx.client';
import { KRX_API_URLS, KRX_MARKETS } from '../constants/krx.constants';
import { mapKrxDailyPrice, mapKrxStock } from '../mappers/krx.mapper';
import { Stock } from '../../stocks/entities/stock.entity';
import { StockDetail } from '../../stocks/entities/stock-detail.entity';
import { StockPriceDaily } from '../../stocks/entities/stock-price-daily.entity';

@Injectable()
export class KrxService {
  constructor(
    private readonly krxClient: KrxClient,

    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,

    @InjectRepository(StockDetail)
    private readonly stockDetailRepository: Repository<StockDetail>,

    @InjectRepository(StockPriceDaily)
    private readonly stockPriceDailyRepository: Repository<StockPriceDaily>,
  ) {}

  async syncAllStocks(date?: string) {
    const targetDate =
      date ??
      (await this.findLatestAvailableDate(
        KRX_API_URLS.KOSPI_STOCKS,
        'KRX 종목 기본정보 기준일',
      ));
    const basDd = targetDate.replaceAll('-', '');

    const kospiResult = await this.syncStocksByMarket(
      KRX_API_URLS.KOSPI_STOCKS,
      basDd,
      KRX_MARKETS.KOSPI,
    );

    const kosdaqResult = await this.syncStocksByMarket(
      KRX_API_URLS.KOSDAQ_STOCKS,
      basDd,
      KRX_MARKETS.KOSDAQ,
    );

    return {
      message: 'KRX 종목 기본정보 수집이 완료되었습니다.',
      date: targetDate,
      kospiResult,
      kosdaqResult,
    };
  }

  async syncStocksByMarket(url: string, basDd: string, market: string) {
    const data = await this.krxClient.get(url, {
      basDd,
    });
    const rows = this.getRows(data);

    if (rows.length === 0) {
      throw new BadRequestException(
        `KRX ${market} 종목 기본정보가 없습니다. 기준일을 확인해주세요: ${basDd}`,
      );
    }

    const mappedStocks = rows
      .map((row) => mapKrxStock(row, market))
      .filter((mapped) => mapped.ticker && mapped.companyName);
    const latestTickers: string[] = [
      ...new Set<string>(mappedStocks.map((stock) => String(stock.ticker))),
    ];
    const existingStocks = await this.stockRepository.find({
      where: {
        ticker: In(latestTickers),
      },
      relations: {
        detail: true,
      },
    });
    const stockMap = new Map(
      existingStocks.map((stock) => [stock.ticker, stock]),
    );

    let insertedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let skippedCount = 0;
    skippedCount = rows.length - mappedStocks.length;

    for (const mapped of mappedStocks) {
      let stock = stockMap.get(mapped.ticker);

      if (!stock) {
        stock = this.stockRepository.create({
          ticker: mapped.ticker,
          companyName: mapped.companyName,
          market: mapped.market,
          sector: mapped.sector,
          currency: mapped.currency,
          status: mapped.status as any,
          isActive: mapped.isActive,
        });

        const savedStock = await this.stockRepository.save(stock);

        await this.stockDetailRepository.save({
          stockId: savedStock.stockId,
          industryDetail: mapped.industryDetail,
          listingDate: mapped.listingDate as any,
          totalShares: mapped.totalShares,
        });

        insertedCount++;
        continue;
      }

      let changed = false;
      changed =
        this.setIfChanged(stock, 'companyName', mapped.companyName) || changed;
      changed = this.setIfChanged(stock, 'market', mapped.market) || changed;
      changed = this.setIfChanged(stock, 'sector', mapped.sector) || changed;
      changed =
        this.setIfChanged(stock, 'currency', mapped.currency) || changed;
      changed =
        this.setIfChanged(stock, 'status', mapped.status as any) || changed;
      changed =
        this.setIfChanged(stock, 'isActive', mapped.isActive) || changed;

      let detail = stock.detail;
      let detailChanged = false;

      if (!detail) {
        detail = this.stockDetailRepository.create({
          stockId: stock.stockId,
        });
        detailChanged = true;
      }

      detailChanged =
        this.setIfChanged(detail, 'industryDetail', mapped.industryDetail) ||
        detailChanged;
      detailChanged =
        this.setIfChanged(detail, 'listingDate', mapped.listingDate as any) ||
        detailChanged;
      detailChanged =
        this.setIfChanged(detail, 'totalShares', mapped.totalShares) ||
        detailChanged;

      if (!changed && !detailChanged) {
        unchangedCount++;
        continue;
      }

      await this.stockRepository.manager.transaction(async (manager) => {
        if (changed) {
          await manager.save(Stock, stock);
        }

        if (detailChanged) {
          await manager.save(StockDetail, detail);
        }
      });

      updatedCount++;
    }

    const delistedCount = await this.markDelistedStocks(market, latestTickers);

    return {
      market,
      basDd,
      insertedCount,
      updatedCount,
      unchangedCount,
      skippedCount,
      delistedCount,
    };
  }

  async markDelistedStocks(market: string, latestTickers: string[]) {
    if (latestTickers.length === 0) {
      return 0;
    }

    const result = await this.stockRepository.update(
      {
        market,
        status: 'ACTIVE' as any,
        ticker: Not(In(latestTickers)),
      },
      {
        status: 'DELISTED' as any,
        isActive: false,
      },
    );

    return result.affected ?? 0;
  }

  async syncDailyPrices(date?: string) {
    const targetDate =
      date ??
      (await this.findLatestAvailableDate(
        KRX_API_URLS.KOSPI_DAILY_PRICES,
        'KRX 일별 시세 거래일',
      ));
    const basDd = targetDate.replaceAll('-', '');

    const kospiResult = await this.syncDailyPricesByMarket(
      KRX_API_URLS.KOSPI_DAILY_PRICES,
      basDd,
      KRX_MARKETS.KOSPI,
    );

    const kosdaqResult = await this.syncDailyPricesByMarket(
      KRX_API_URLS.KOSDAQ_DAILY_PRICES,
      basDd,
      KRX_MARKETS.KOSDAQ,
    );

    return {
      message: 'KRX 일별 시세 수집이 완료되었습니다.',
      date: targetDate,
      kospiResult,
      kosdaqResult,
    };
  }

  async syncDailyPricesByMarket(url: string, basDd: string, market: string) {
    const data = await this.krxClient.get(url, {
      basDd,
    });

    const rows = this.getRows(data);

    if (rows.length === 0) {
      throw new BadRequestException(
        `KRX ${market} 일별 시세가 없습니다. 거래일을 확인해주세요: ${basDd}`,
      );
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const mapped = mapKrxDailyPrice(row);

      if (!mapped.ticker || !mapped.tradeDate) {
        skippedCount++;
        continue;
      }

      const stock = await this.stockRepository.findOne({
        where: {
          ticker: mapped.ticker,
        },
      });

      if (!stock) {
        skippedCount++;
        continue;
      }

      let price = await this.stockPriceDailyRepository.findOne({
        where: {
          stockId: stock.stockId,
          tradeDate: mapped.tradeDate as any,
        },
      });

      if (!price) {
        price = this.stockPriceDailyRepository.create({
          stockId: stock.stockId,
          tradeDate: mapped.tradeDate as any,
        });
        price.openPrice = mapped.openPrice;
        price.highPrice = mapped.highPrice;
        price.lowPrice = mapped.lowPrice;
        price.closePrice = mapped.closePrice;
        price.volume = mapped.volume;

        await this.stockPriceDailyRepository.save(price);
        insertedCount++;
      } else {
        let changed = false;
        changed =
          this.setIfChanged(price, 'openPrice', mapped.openPrice) || changed;
        changed =
          this.setIfChanged(price, 'highPrice', mapped.highPrice) || changed;
        changed =
          this.setIfChanged(price, 'lowPrice', mapped.lowPrice) || changed;
        changed =
          this.setIfChanged(price, 'closePrice', mapped.closePrice) || changed;
        changed = this.setIfChanged(price, 'volume', mapped.volume) || changed;

        if (changed) {
          await this.stockPriceDailyRepository.save(price);
          updatedCount++;
        } else {
          unchangedCount++;
        }
      }

      await this.upsertStockMarketDetail(
        stock.stockId,
        mapped.marketCap,
        mapped.totalShares,
      );
    }

    return {
      market,
      basDd,
      insertedCount,
      updatedCount,
      unchangedCount,
      skippedCount,
    };
  }

  private async upsertStockMarketDetail(
    stockId: number,
    marketCap: string | null,
    totalShares: string | null,
  ) {
    let detail = await this.stockDetailRepository.findOne({
      where: {
        stockId,
      },
    });

    if (!detail) {
      detail = this.stockDetailRepository.create({
        stockId,
        marketCap,
        totalShares,
      });

      await this.stockDetailRepository.save(detail);
      return;
    }

    let changed = false;
    changed = this.setIfChanged(detail, 'marketCap', marketCap) || changed;
    changed = this.setIfChanged(detail, 'totalShares', totalShares) || changed;

    if (changed) {
      await this.stockDetailRepository.save(detail);
    }
  }

  private setIfChanged<T extends object, K extends keyof T>(
    target: T,
    field: K,
    value: T[K],
  ) {
    if (target[field] === value) {
      return false;
    }

    target[field] = value;
    return true;
  }

  private getRows(data: any) {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.OutBlock_1)) {
      return data.OutBlock_1;
    }

    if (Array.isArray(data?.output)) {
      return data.output;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    return [];
  }

  private getTodayInKst() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private async findLatestAvailableDate(url: string, label: string) {
    const today = this.getTodayInKst();

    for (let daysAgo = 0; daysAgo < 10; daysAgo++) {
      const date = this.addDays(today, -daysAgo);
      const basDd = date.replaceAll('-', '');
      const data = await this.krxClient.get(url, {
        basDd,
      });

      if (this.getRows(data).length > 0) {
        return date;
      }
    }

    throw new InternalServerErrorException(
      `최근 10일 안에서 ${label}을 찾지 못했습니다.`,
    );
  }

  private addDays(date: string, days: number) {
    const baseDate = new Date(`${date}T00:00:00+09:00`);
    baseDate.setUTCDate(baseDate.getUTCDate() + days);

    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(baseDate);
  }
}
