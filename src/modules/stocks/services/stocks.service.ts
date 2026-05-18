import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockPriceQueryDto } from '../dto/stock-price-query.dto';
import { StockSearchQueryDto } from '../dto/stock-search-query.dto';
import { UpdateStockDto } from '../dto/update-stock.dto';
import { UpdateStockStatusDto } from '../dto/update-stock-status.dto';
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

  async findAll(query: StockSearchQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const queryBuilder = this.stockRepository
      .createQueryBuilder('stock')
      .leftJoinAndSelect('stock.detail', 'detail')
      .where('stock.isActive = :isActive', {
        isActive: true,
      })
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

  async findByTicker(ticker: string) {
    const stock = await this.stockRepository.findOne({
      where: {
        ticker,
        isActive: true,
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

  async findDailyPrices(ticker: string, query: StockPriceQueryDto) {
    const stock = await this.findByTicker(ticker);

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
        stockId: stock.stockId,
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

  async findLatestDailyPrice(ticker: string) {
    const stock = await this.findByTicker(ticker);

    const price = await this.stockPriceDailyRepository.findOne({
      where: {
        stockId: stock.stockId,
      },
      order: {
        tradeDate: 'DESC',
      },
    });

    if (!price) {
      throw new NotFoundException('종목 시세를 찾을 수 없습니다.');
    }

    return {
      stockId: stock.stockId,
      ticker: stock.ticker,
      companyName: stock.companyName,
      price,
    };
  }

  async updateStatus(
    ticker: string,
    updateStockStatusDto: UpdateStockStatusDto,
  ) {
    const stock = await this.findAnyByTicker(ticker);

    stock.status = updateStockStatusDto.status as unknown as StockStatus;
    stock.isActive =
      updateStockStatusDto.isActive ?? updateStockStatusDto.status === 'ACTIVE';

    await this.stockRepository.save(stock);

    return stock;
  }

  async update(ticker: string, updateStockDto: UpdateStockDto) {
    if (Object.values(updateStockDto).every((value) => value === undefined)) {
      throw new BadRequestException('수정할 항목을 하나 이상 입력해주세요.');
    }

    const stock = await this.findAnyByTicker(ticker);

    const stockFields: Array<keyof UpdateStockDto> = [
      'companyName',
      'market',
      'sector',
      'currency',
      'status',
      'isActive',
    ];
    const detailFields: Array<keyof UpdateStockDto> = [
      'description',
      'ceoName',
      'industryDetail',
      'listingDate',
      'totalShares',
      'homepageUrl',
    ];

    for (const field of stockFields) {
      if (updateStockDto[field] !== undefined) {
        (stock as any)[field] = updateStockDto[field];
      }
    }

    let detail = stock.detail;
    const hasDetailUpdate = detailFields.some(
      (field) => updateStockDto[field] !== undefined,
    );

    if (hasDetailUpdate) {
      detail =
        detail ??
        this.stockDetailRepository.create({
          stockId: stock.stockId,
        });

      for (const field of detailFields) {
        if (updateStockDto[field] !== undefined) {
          (detail as any)[field] = updateStockDto[field];
        }
      }
    }

    await this.stockRepository.manager.transaction(async (manager) => {
      await manager.save(Stock, stock);

      if (detail && hasDetailUpdate) {
        await manager.save(StockDetail, detail);
      }
    });

    return this.findAnyByTicker(ticker);
  }

  async softDelete(ticker: string) {
    const stock = await this.findAnyByTicker(ticker);

    stock.status = StockStatus.DELISTED;
    stock.isActive = false;

    await this.stockRepository.save(stock);

    return {
      message: '종목이 삭제 처리되었습니다.',
      ticker: stock.ticker,
      status: stock.status,
      isActive: stock.isActive,
    };
  }

  private async findAnyByTicker(ticker: string) {
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
}
