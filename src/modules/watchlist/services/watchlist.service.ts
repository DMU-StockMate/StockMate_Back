import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KiwoomWebSocketService } from '../../kiwoom/services/kiwoom-websocket.service';
import { StockPriceDaily } from '../../stocks/entities/stock-price-daily.entity';
import { Stock, StockStatus } from '../../stocks/entities/stock.entity';
import { CreateWatchlistDto } from '../dto/create-watchlist.dto';
import { Watchlist } from '../entities/watchlist.entity';

@Injectable()
export class WatchlistService {
  constructor(
    @InjectRepository(Watchlist)
    private readonly watchlistRepository: Repository<Watchlist>,

    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,

    @InjectRepository(StockPriceDaily)
    private readonly stockPriceDailyRepository: Repository<StockPriceDaily>,

    private readonly kiwoomWebSocketService: KiwoomWebSocketService,
  ) {}

  async create(userId: number, dto: CreateWatchlistDto) {
    const stock = await this.findActiveStock(dto.stockCode);
    const exists = await this.watchlistRepository.findOne({
      where: {
        userId,
        stockId: stock.stockId,
      },
    });

    if (exists) {
      throw new ConflictException('이미 관심 종목에 등록되어 있습니다.');
    }

    const watchlist = this.watchlistRepository.create({
      userId,
      stockId: stock.stockId,
      stock,
    });
    const saved = await this.watchlistRepository.save(watchlist);

    return this.toResponse({ ...saved, stock });
  }

  async findAll(userId: number) {
    const watchlists = await this.watchlistRepository.find({
      where: {
        userId,
      },
      relations: {
        stock: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return Promise.all(
      watchlists.map((watchlist) => this.toResponse(watchlist)),
    );
  }

  async findOne(userId: number, watchlistId: string) {
    const watchlist = await this.findOwnedWatchlist(userId, watchlistId);
    return this.toResponse(watchlist);
  }

  async remove(userId: number, watchlistId: string) {
    const watchlist = await this.findOwnedWatchlist(userId, watchlistId);
    await this.watchlistRepository.remove(watchlist);

    if (this.kiwoomWebSocketService.isSubscribedStock(watchlist.stock.ticker)) {
      this.kiwoomWebSocketService.unsubscribeStocks([watchlist.stock.ticker]);
    }

    return {
      message: '관심 종목이 삭제되었습니다.',
      watchlistId,
    };
  }

  async check(userId: number, stockCode: string) {
    const stock = await this.findActiveStock(stockCode);
    const watchlist = await this.watchlistRepository.findOne({
      where: {
        userId,
        stockId: stock.stockId,
      },
    });

    return {
      stockCode: stock.ticker,
      ticker: stock.ticker,
      isWatchlisted: Boolean(watchlist),
      watchlistId: watchlist?.watchlistId ?? null,
    };
  }

  async subscribeRealtime(userId: number, watchlistId: string) {
    const watchlist = await this.findOwnedWatchlist(userId, watchlistId);
    const stockCode = watchlist.stock.ticker;

    this.kiwoomWebSocketService.subscribeStocks([stockCode]);

    return {
      message: '관심 종목 실시간 시세 구독 요청이 완료되었습니다.',
      watchlistId,
      stockCode,
      ticker: stockCode,
    };
  }

  async unsubscribeRealtime(userId: number, watchlistId: string) {
    const watchlist = await this.findOwnedWatchlist(userId, watchlistId);
    const stockCode = watchlist.stock.ticker;

    this.kiwoomWebSocketService.unsubscribeStocks([stockCode]);

    return {
      message: '관심 종목 실시간 시세 구독 해제 요청이 완료되었습니다.',
      watchlistId,
      stockCode,
      ticker: stockCode,
    };
  }

  async getRealtimePrice(userId: number, watchlistId: string) {
    const watchlist = await this.findOwnedWatchlist(userId, watchlistId);
    const stockCode = watchlist.stock.ticker;
    const price = await this.kiwoomWebSocketService.getCurrentPrice(stockCode);
    const [latestPrice] = await this.findTwoLatestPricesByStock(
      watchlist.stockId,
    );
    const previousClosePrice = this.toNumberOrNull(latestPrice?.closePrice);
    const change = this.calculatePriceChange(price, previousClosePrice);

    if (price === null) {
      throw new NotFoundException(
        '현재가 정보가 없습니다. 먼저 관심 종목 실시간 구독을 요청해야 합니다.',
      );
    }

    return {
      watchlistId,
      stockCode,
      ticker: stockCode,
      price,
      currentPrice: price,
      previousClosePrice,
      changePrice: change.changePrice,
      changeRate: change.changeRate,
    };
  }

  private async findOwnedWatchlist(userId: number, watchlistId: string) {
    const watchlist = await this.watchlistRepository.findOne({
      where: {
        watchlistId,
        userId,
      },
      relations: {
        stock: true,
      },
    });

    if (!watchlist) {
      throw new NotFoundException('관심 종목을 찾을 수 없습니다.');
    }

    return watchlist;
  }

  private async findActiveStock(stockCode: string) {
    const stock = await this.stockRepository.findOne({
      where: {
        ticker: stockCode,
        status: StockStatus.ACTIVE,
        isActive: true,
      },
    });

    if (!stock) {
      throw new NotFoundException('종목을 찾을 수 없습니다.');
    }

    return stock;
  }

  private async toResponse(watchlist: Watchlist) {
    const stockCode = watchlist.stock.ticker;
    const [latestPrice, previousPrice] = await this.findTwoLatestPricesByStock(
      watchlist.stockId,
    );
    const realtimePrice =
      await this.kiwoomWebSocketService.getCurrentPrice(stockCode);
    const latestClose = this.toNumberOrNull(latestPrice?.closePrice);
    const previousClose = this.toNumberOrNull(previousPrice?.closePrice);
    const currentPrice = realtimePrice ?? latestClose;
    const basePrice = realtimePrice !== null ? latestClose : previousClose;
    const change = this.calculatePriceChange(currentPrice, basePrice);

    return {
      watchlistId: watchlist.watchlistId,
      userId: watchlist.userId,
      stockId: watchlist.stockId,
      stockCode,
      ticker: stockCode,
      companyName: watchlist.stock.companyName,
      market: watchlist.stock.market,
      sector: watchlist.stock.sector,
      currency: watchlist.stock.currency,
      status: watchlist.stock.status,
      currentPrice,
      realtimePrice,
      previousClosePrice: basePrice,
      changePrice: change.changePrice,
      changeRate: change.changeRate,
      isRealtimeSubscribed:
        this.kiwoomWebSocketService.isSubscribedStock(stockCode),
      createdAt: watchlist.createdAt,
    };
  }

  private async findTwoLatestPricesByStock(stockId: number) {
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

  private calculatePriceChange(
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

  private toNumberOrNull(value?: string | number | null) {
    if (value === null || value === undefined) {
      return null;
    }

    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : null;
  }
}
