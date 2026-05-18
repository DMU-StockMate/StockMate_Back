import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    let savedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const mapped = mapKrxStock(row, market);

      if (!mapped.ticker || !mapped.companyName) {
        skippedCount++;
        continue;
      }

      let stock = await this.stockRepository.findOne({
        where: {
          ticker: mapped.ticker,
        },
      });

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
      } else {
        stock.companyName = mapped.companyName;
        stock.market = mapped.market;
        stock.sector = mapped.sector;
        stock.currency = mapped.currency;
        stock.status = mapped.status as any;
        stock.isActive = mapped.isActive;
      }

      const savedStock = await this.stockRepository.save(stock);

      await this.stockDetailRepository.save({
        stockId: savedStock.stockId,
        industryDetail: mapped.industryDetail,
        listingDate: mapped.listingDate as any,
        totalShares: mapped.totalShares,
      });

      savedCount++;
    }

    return {
      market,
      basDd,
      savedCount,
      skippedCount,
    };
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

    let savedCount = 0;
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
      }

      price.openPrice = mapped.openPrice;
      price.highPrice = mapped.highPrice;
      price.lowPrice = mapped.lowPrice;
      price.closePrice = mapped.closePrice;
      price.volume = mapped.volume;

      await this.stockPriceDailyRepository.save(price);

      await this.stockDetailRepository.update(
        { stockId: stock.stockId },
        {
          marketCap: mapped.marketCap,
          totalShares: mapped.totalShares,
        },
      );

      savedCount++;
    }

    return {
      market,
      basDd,
      savedCount,
      skippedCount,
    };
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
