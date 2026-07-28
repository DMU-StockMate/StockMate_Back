import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KiwoomWebSocketService } from '../../kiwoom/services/kiwoom-websocket.service';
import { StockPriceDaily } from '../entities/stock-price-daily.entity';

@Injectable()
export class StockPriceSnapshotService {
  constructor(
    @InjectRepository(StockPriceDaily)
    private readonly stockPriceDailyRepository: Repository<StockPriceDaily>,

    private readonly kiwoomWebSocketService: KiwoomWebSocketService,
  ) {}

  async findTwoLatestPricesByStock(stockId: number) {
    return this.stockPriceDailyRepository.find({
      where: {
        stockId,
      },
      order: {
        tradeDate: 'DESC',
      },
      take: 2,
    });
  }

  async buildCurrentPriceSnapshot(params: {
    stockId: number;
    ticker: string;
    requireLatestPrice?: boolean;
    latestPriceNotFoundMessage?: string;
  }) {
    const [latestPrice, previousPrice] = await this.findTwoLatestPricesByStock(
      params.stockId,
    );

    if (!latestPrice && params.requireLatestPrice) {
      throw new NotFoundException(params.latestPriceNotFoundMessage);
    }

    const realtimePrice = await this.kiwoomWebSocketService.getCurrentPrice(
      params.ticker,
    );
    const latestClose = this.toNumberOrNull(latestPrice?.closePrice);
    const previousClose = this.toNumberOrNull(previousPrice?.closePrice);
    const currentPrice = realtimePrice ?? latestClose;
    const previousClosePrice =
      realtimePrice !== null ? latestClose : previousClose;
    const change =
      realtimePrice !== null
        ? this.calculatePriceChange(currentPrice, previousClosePrice)
        : this.calculatePriceChangeFromPrices(latestPrice, previousPrice);

    return {
      latestPrice,
      previousPrice,
      currentPrice,
      realtimePrice,
      previousClosePrice,
      changePrice: change.changePrice,
      changeRate: change.changeRate,
    };
  }

  calculatePriceChangeFromPrices(
    latestPrice?: StockPriceDaily,
    previousPrice?: StockPriceDaily,
  ) {
    const latestClose = this.toNumberOrNull(latestPrice?.closePrice);
    const previousClose = this.toNumberOrNull(previousPrice?.closePrice);

    return this.calculatePriceChange(latestClose, previousClose);
  }

  calculatePriceChange(
    currentPrice: number | null,
    previousClosePrice: number | null,
  ) {
    if (
      currentPrice === null ||
      previousClosePrice === null ||
      previousClosePrice === 0
    ) {
      return {
        changePrice: null,
        changeRate: null,
      };
    }

    const changePrice = currentPrice - previousClosePrice;

    return {
      changePrice,
      changeRate: (changePrice / previousClosePrice) * 100,
    };
  }

  toNumberOrNull(value?: string | number | null) {
    if (value === null || value === undefined) {
      return null;
    }

    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : null;
  }
}
