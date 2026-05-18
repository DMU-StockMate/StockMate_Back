import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateStockDto } from '../dto/create-stock.dto';
import { StockPriceQueryDto } from '../dto/stock-price-query.dto';
import { StockSearchQueryDto } from '../dto/stock-search-query.dto';
import { StockDetail } from '../entities/stock-detail.entity';
import { StockPriceDaily } from '../entities/stock-price-daily.entity';
import { Stock, StockStatus } from '../entities/stock.entity';

@Injectable()
export class StocksService {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,

    @InjectRepository(StockDetail)
    private readonly stockDetailRepository: Repository<StockDetail>,

    @InjectRepository(StockPriceDaily)
    private readonly stockPriceDailyRepository: Repository<StockPriceDaily>,
  ) {}

  async create(createStockDto: CreateStockDto) {
    const exists = await this.stockRepository.findOne({
      where: {
        ticker: createStockDto.ticker,
      },
    });

    if (exists) {
      throw new ConflictException('이미 등록된 종목 코드입니다.');
    }

    const stock = this.stockRepository.create({
      ticker: createStockDto.ticker,
      companyName: createStockDto.companyName,
      market: createStockDto.market,
      sector: createStockDto.sector,
      currency: createStockDto.currency ?? 'KRW',
      status: (createStockDto.status ?? StockStatus.ACTIVE) as StockStatus,
      isActive: createStockDto.isActive ?? true,
    });

    const savedStock = await this.stockRepository.save(stock);

    await this.stockDetailRepository.save({
      stockId: savedStock.stockId,
      description: createStockDto.description,
      ceoName: createStockDto.ceoName,
      industryDetail: createStockDto.industryDetail,
      listingDate: createStockDto.listingDate,
      totalShares: createStockDto.totalShares,
      homepageUrl: createStockDto.homepageUrl,
    });

    return this.findOne(savedStock.stockId);
  }

  async findAll(query: StockSearchQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const queryBuilder = this.stockRepository
      .createQueryBuilder('stock')
      .leftJoinAndSelect('stock.detail', 'detail')
      .orderBy('stock.companyName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.keyword?.trim()) {
      queryBuilder.andWhere(
        '(stock.ticker LIKE :keyword OR stock.companyName LIKE :keyword)',
        {
          keyword: `%${query.keyword.trim()}%`,
        },
      );
    }

    if (query.market) {
      queryBuilder.andWhere('stock.market = :market', {
        market: query.market,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('stock.status = :status', {
        status: query.status,
      });
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(stockId: number) {
    const stock = await this.stockRepository.findOne({
      where: {
        stockId,
      },
      relations: {
        detail: true,
      },
    });

    if (!stock) {
      throw new NotFoundException('종목을 찾을 수 없습니다.');
    }

    return stock;
  }

  async findByTicker(ticker: string) {
    const stock = await this.stockRepository.findOne({
      where: {
        ticker,
      },
      relations: {
        detail: true,
      },
    });

    if (!stock) {
      throw new NotFoundException('종목을 찾을 수 없습니다.');
    }

    return stock;
  }

  async findDailyPrices(stockId: number, query: StockPriceQueryDto) {
    const stock = await this.findOne(stockId);

    if (
      query.startDate &&
      query.endDate &&
      query.startDate > query.endDate
    ) {
      throw new BadRequestException('시작 날짜는 종료 날짜보다 늦을 수 없습니다.');
    }

    const queryBuilder = this.stockPriceDailyRepository
      .createQueryBuilder('price')
      .where('price.stockId = :stockId', {
        stockId,
      })
      .orderBy('price.tradeDate', 'DESC');

    if (query.startDate) {
      queryBuilder.andWhere('price.tradeDate >= :startDate', {
        startDate: query.startDate,
      });
    }

    if (query.endDate) {
      queryBuilder.andWhere('price.tradeDate <= :endDate', {
        endDate: query.endDate,
      });
    }

    const prices = await queryBuilder.getMany();

    return {
      stockId: stock.stockId,
      ticker: stock.ticker,
      companyName: stock.companyName,
      prices,
    };
  }
}
