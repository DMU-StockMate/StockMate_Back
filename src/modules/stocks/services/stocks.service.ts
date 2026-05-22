import {
  BadRequestException,
  Injectable,
  NotFoundException,
  NotImplementedException,
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
import { StockMarket } from '../../enums/stock-market.enum';
import { KiwoomWebSocketService } from '../../kiwoom/services/kiwoom-websocket.service';

@Injectable()
export class StocksService {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,

    @InjectRepository(StockDetail)
    private readonly stockDetailRepository: Repository<StockDetail>,

    @InjectRepository(StockPriceDaily)
    private readonly stockPriceDailyRepository: Repository<StockPriceDaily>,

    private readonly kiwoomWebSocketService: KiwoomWebSocketService
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

  async findAllStocks(query: StockSearchQueryDto) {
    const queryBuilder = this.createStockSearchQueryBuilder(query)
      .orderBy('stock.companyName', 'ASC');

    return queryBuilder.getMany();
  }

  async search(query: StockSearchQueryDto) {
    return this.findAll(query);
  }

  async findCurrentPrice(ticker: string) {
    const { stockId, companyName, price } = await this.findLatestDailyPrice(ticker);

    return {
      stockId,
      ticker,
      companyName,
      tradeDate: price.tradeDate,
      currentPrice: price.closePrice,
      price,
    };
  }

  async findSummary(ticker: string) {
    const stock = await this.findByTicker(ticker);
    const latestPrice = await this.stockPriceDailyRepository.findOne({
      where: {
        stockId: stock.stockId,
      },
      order: {
        tradeDate: 'DESC',
      },
    });

    return {
      stock,
      latestPrice,
      summary: {
        ticker: stock.ticker,
        companyName: stock.companyName,
        market: stock.market,
        sector: stock.sector,
        description: stock.detail?.description ?? null,
        marketCap: stock.detail?.marketCap ?? null,
        currentPrice: latestPrice?.closePrice ?? null,
        tradeDate: latestPrice?.tradeDate ?? null,
      },
    };
  }

  async findChart(ticker: string, query: StockPriceQueryDto) {
    return this.findDailyChart(ticker, query);
  }

  async findDailyChart(ticker: string, query: StockPriceQueryDto) {
    const stock = await this.findByTicker(ticker);
    const prices = await this.findPricesByStock(stock.stockId, query, 'ASC');

    return {
      stockId: stock.stockId,
      ticker: stock.ticker,
      companyName: stock.companyName,
      interval: 'daily',
      prices,
    };
  }

  async findWeeklyChart(ticker: string, query: StockPriceQueryDto) {
    const stock = await this.findByTicker(ticker);
    const prices = await this.findPricesByStock(stock.stockId, query, 'ASC');

    return {
      stockId: stock.stockId,
      ticker: stock.ticker,
      companyName: stock.companyName,
      interval: 'weekly',
      prices: this.aggregatePrices(prices, (tradeDate) =>
        this.getWeekKey(tradeDate),
      ),
    };
  }

  async findMonthlyChart(ticker: string, query: StockPriceQueryDto) {
    const stock = await this.findByTicker(ticker);
    const prices = await this.findPricesByStock(stock.stockId, query, 'ASC');

    return {
      stockId: stock.stockId,
      ticker: stock.ticker,
      companyName: stock.companyName,
      interval: 'monthly',
      prices: this.aggregatePrices(prices, (tradeDate) =>
        tradeDate.slice(0, 7),
      ),
    };
  }

  async findOhlcv(ticker: string, query: StockPriceQueryDto) {
    const chart = await this.findDailyChart(ticker, query);

    return {
      ...chart,
      prices: chart.prices.map((price) => ({
        tradeDate: price.tradeDate,
        open: price.openPrice,
        high: price.highPrice,
        low: price.lowPrice,
        close: price.closePrice,
        volume: price.volume,
      })),
    };
  }

  findFinancials(ticker: string) {
    return this.throwStockDataNotImplemented(ticker, '재무 정보');
  }

  findIndicators(ticker: string) {
    return this.throwStockDataNotImplemented(ticker, '투자 지표');
  }

  findDividends(ticker: string) {
    return this.throwStockDataNotImplemented(ticker, '배당 정보');
  }

  findMarkets() {
    return Object.values(StockMarket);
  }

  async findRiseRankings(limit = 20) {
    return this.findPriceRankings('rise', limit);
  }

  async findFallRankings(limit = 20) {
    return this.findPriceRankings('fall', limit);
  }

  async findVolumeRankings(limit = 20) {
    return this.findPriceRankings('volume', limit);
  }

  async findSectors() {
    const rows = await this.stockRepository
      .createQueryBuilder('stock')
      .select('stock.sector', 'sector')
      .addSelect('COUNT(*)', 'stockCount')
      .where('stock.isActive = :isActive', {
        isActive: true,
      })
      .andWhere('stock.sector IS NOT NULL')
      .andWhere("stock.sector <> ''")
      .groupBy('stock.sector')
      .orderBy('stock.sector', 'ASC')
      .getRawMany<{ sector: string; stockCount: string }>();

    return rows.map((row) => ({
      sectorId: row.sector,
      name: row.sector,
      stockCount: Number(row.stockCount),
    }));
  }

  async findStocksBySector(sectorId: string, query: StockSearchQueryDto) {
    const queryBuilder = this.createStockSearchQueryBuilder(query)
      .andWhere('stock.sector = :sector', {
        sector: sectorId,
      })
      .orderBy('stock.companyName', 'ASC');

    return queryBuilder.getMany();
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

    const prices = await this.findPricesByStock(stock.stockId, query, 'DESC');

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

  private createStockSearchQueryBuilder(query: StockSearchQueryDto) {
    const queryBuilder = this.stockRepository
      .createQueryBuilder('stock')
      .leftJoinAndSelect('stock.detail', 'detail')
      .where('stock.isActive = :isActive', {
        isActive: true,
      });

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

    return queryBuilder;
  }

  private async findPricesByStock(
    stockId: number,
    query: StockPriceQueryDto,
    order: 'ASC' | 'DESC',
  ) {
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
      .orderBy('price.tradeDate', order);

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

    if (query.limit) {
      queryBuilder.take(query.limit);
    }

    return queryBuilder.getMany();
  }

  private aggregatePrices(
    prices: StockPriceDaily[],
    getGroupKey: (tradeDate: string) => string,
  ) {
    const grouped = new Map<string, StockPriceDaily[]>();

    for (const price of prices) {
      const key = getGroupKey(price.tradeDate);
      grouped.set(key, [...(grouped.get(key) ?? []), price]);
    }

    return Array.from(grouped.entries()).map(([period, group]) => {
      const first = group[0];
      const last = group[group.length - 1];
      const high = this.maxDecimal(group.map((price) => price.highPrice));
      const low = this.minDecimal(group.map((price) => price.lowPrice));
      const volume = group.reduce(
        (sum, price) => sum + BigInt(price.volume ?? '0'),
        0n,
      );

      return {
        period,
        startDate: first.tradeDate,
        endDate: last.tradeDate,
        openPrice: first.openPrice,
        highPrice: high,
        lowPrice: low,
        closePrice: last.closePrice,
        volume: volume.toString(),
      };
    });
  }

  private getWeekKey(tradeDate: string) {
    const date = new Date(`${tradeDate}T00:00:00Z`);
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(
      ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );

    return `${date.getUTCFullYear()}-W${week.toString().padStart(2, '0')}`;
  }

  private maxDecimal(values: Array<string | null | undefined>) {
    return values
      .filter((value): value is string => value !== null && value !== undefined)
      .reduce<string | null>((max, value) => {
        if (max === null) {
          return value;
        }

        return Number(value) > Number(max) ? value : max;
      }, null);
  }

  private minDecimal(values: Array<string | null | undefined>) {
    return values
      .filter((value): value is string => value !== null && value !== undefined)
      .reduce<string | null>((min, value) => {
        if (min === null) {
          return value;
        }

        return Number(value) < Number(min) ? value : min;
      }, null);
  }

  private normalizeLimit(limit: number) {
    if (!Number.isFinite(limit)) {
      return 20;
    }

    return Math.min(Math.max(Math.trunc(limit), 1), 100);
  }

  private async findPriceRankings(
    type: 'rise' | 'fall' | 'volume',
    limit: number,
  ) {
    const normalizedLimit = this.normalizeLimit(limit);
    const orderBy =
      type === 'volume'
        ? 'latest.volume'
        : 'changeRate';
    const orderDirection = type === 'fall' ? 'ASC' : 'DESC';

    const queryBuilder = this.stockRepository
      .createQueryBuilder('stock')
      .innerJoin(
        StockPriceDaily,
        'latest',
        `latest.stock_id = stock.stock_id
        AND latest.trade_date = (
          SELECT MAX(lp.trade_date)
          FROM stock_price_daily lp
          WHERE lp.stock_id = stock.stock_id
        )`,
      )
      .leftJoin(
        StockPriceDaily,
        'previous',
        `previous.stock_id = stock.stock_id
        AND previous.trade_date = (
          SELECT MAX(pp.trade_date)
          FROM stock_price_daily pp
          WHERE pp.stock_id = stock.stock_id
            AND pp.trade_date < latest.trade_date
        )`,
      )
      .select('stock.stockId', 'stockId')
      .addSelect('stock.ticker', 'ticker')
      .addSelect('stock.companyName', 'companyName')
      .addSelect('stock.market', 'market')
      .addSelect('stock.sector', 'sector')
      .addSelect('latest.tradeDate', 'tradeDate')
      .addSelect('latest.openPrice', 'openPrice')
      .addSelect('latest.highPrice', 'highPrice')
      .addSelect('latest.lowPrice', 'lowPrice')
      .addSelect('latest.closePrice', 'closePrice')
      .addSelect('latest.volume', 'volume')
      .addSelect('previous.closePrice', 'previousClosePrice')
      .addSelect(
        `CASE
          WHEN previous.close_price IS NULL OR previous.close_price = 0 THEN NULL
          ELSE ((latest.close_price - previous.close_price) / previous.close_price) * 100
        END`,
        'changeRate',
      )
      .where('stock.isActive = :isActive', {
        isActive: true,
      })
      .orderBy(orderBy, orderDirection)
      .limit(normalizedLimit);

    if (type !== 'volume') {
      queryBuilder.andWhere('previous.close_price IS NOT NULL');
    }

    const rows = await queryBuilder.getRawMany();

    return rows.map((row) => ({
      stockId: row.stockId,
      ticker: row.ticker,
      companyName: row.companyName,
      market: row.market,
      sector: row.sector,
      tradeDate: row.tradeDate,
      openPrice: row.openPrice,
      highPrice: row.highPrice,
      lowPrice: row.lowPrice,
      closePrice: row.closePrice,
      volume: row.volume,
      previousClosePrice: row.previousClosePrice,
      changeRate:
        row.changeRate === null || row.changeRate === undefined
          ? null
          : Number(row.changeRate),
    }));
  }

  private throwStockDataNotImplemented(ticker: string, dataName: string) {
    throw new NotImplementedException(
      `${ticker} ${dataName}를 저장하는 테이블이 아직 없습니다.`,
    );
  }

  subscribeRealtime(stockCodes: string[]) {
    this.kiwoomWebSocketService.subscribeStocks(stockCodes);

    return {
      message: '실시간 시세 구독 요청이 완료되었습니다.',
      stockCodes,
    };
  }

  unsubscribeRealtime(stockCodes: string[]) {
    this.kiwoomWebSocketService.unsubscribeStocks(stockCodes);

    return {
      message: '실시간 시세 구독 해제 요청이 완료되었습니다.',
      stockCodes,
    };
  }

  async getCurrentPrice(stockCode: string) {
    const price =
      await this.kiwoomWebSocketService.getCurrentPrice(stockCode);

    if (!price) {
      throw new NotFoundException(
        '현재가 정보가 없습니다. 먼저 실시간 구독을 요청해야 합니다.',
      );
    }

    return {
      stockCode,
      price,
    };
  }

  getAllCurrentPrices() {
    return this.kiwoomWebSocketService.getAllCurrentPrices();
  }
}
