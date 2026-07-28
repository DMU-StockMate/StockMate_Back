import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KiwoomWebSocketService } from '../../kiwoom/services/kiwoom-websocket.service';
import { Stock, StockStatus } from '../../stocks/entities/stock.entity';
import { StockPriceSnapshotService } from '../../stocks/services/stock-price-snapshot.service';
import { CreateWatchlistDto } from '../dto/create-watchlist.dto';
import { Watchlist } from '../entities/watchlist.entity';

@Injectable()
export class WatchlistService {
  constructor(
    @InjectRepository(Watchlist)
    private readonly watchlistRepository: Repository<Watchlist>,

    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,

    private readonly kiwoomWebSocketService: KiwoomWebSocketService,

    private readonly stockPriceSnapshotService: StockPriceSnapshotService,
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
    const [latestPrice] =
      await this.stockPriceSnapshotService.findTwoLatestPricesByStock(
        watchlist.stockId,
      );
    const previousClosePrice = this.stockPriceSnapshotService.toNumberOrNull(
      latestPrice?.closePrice,
    );
    const change = this.stockPriceSnapshotService.calculatePriceChange(
      price,
      previousClosePrice,
    );

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
    const snapshot =
      await this.stockPriceSnapshotService.buildCurrentPriceSnapshot({
        stockId: watchlist.stockId,
        ticker: stockCode,
      });

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
      currentPrice: snapshot.currentPrice,
      realtimePrice: snapshot.realtimePrice,
      previousClosePrice: snapshot.previousClosePrice,
      changePrice: snapshot.changePrice,
      changeRate: snapshot.changeRate,
      isRealtimeSubscribed:
        this.kiwoomWebSocketService.isSubscribedStock(stockCode),
      createdAt: watchlist.createdAt,
    };
  }
}
