import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    return watchlists.map((watchlist) => this.toResponse(watchlist));
  }

  async findOne(userId: number, watchlistId: string) {
    const watchlist = await this.findOwnedWatchlist(userId, watchlistId);
    return this.toResponse(watchlist);
  }

  async remove(userId: number, watchlistId: string) {
    const watchlist = await this.findOwnedWatchlist(userId, watchlistId);
    await this.watchlistRepository.remove(watchlist);

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

  private toResponse(watchlist: Watchlist) {
    return {
      watchlistId: watchlist.watchlistId,
      userId: watchlist.userId,
      stockId: watchlist.stockId,
      stockCode: watchlist.stock.ticker,
      ticker: watchlist.stock.ticker,
      companyName: watchlist.stock.companyName,
      market: watchlist.stock.market,
      sector: watchlist.stock.sector,
      currency: watchlist.stock.currency,
      status: watchlist.stock.status,
      createdAt: watchlist.createdAt,
    };
  }
}
