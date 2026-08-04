import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { concat, from, fromEvent, Observable, of } from 'rxjs';
import { filter, map, mergeMap } from 'rxjs/operators';
import type { MessageEvent } from '@nestjs/common';
import { StockPriceQueryDto } from '../dto/stock-price-query.dto';
import { StockSearchQueryDto } from '../dto/stock-search-query.dto';
import { UpdateStockDto } from '../dto/update-stock.dto';
import { UpdateStockStatusDto } from '../dto/update-stock-status.dto';
import { StockDetail } from '../entities/stock-detail.entity';
import { StockInvestmentIndicator } from '../entities/stock-investment-indicator.entity';
import { StockPriceDaily } from '../entities/stock-price-daily.entity';
import { Stock, StockStatus } from '../entities/stock.entity';
import { StockMarket } from '../../enums/stock-market.enum';
import { DartService } from '../../dart/services/dart.service';
import { KiwoomAuthService } from '../../kiwoom/services/kiwoom-auth.service';
import {
  KiwoomWebSocketService,
  StockTick,
} from '../../kiwoom/services/kiwoom-websocket.service';
import { StockPriceSnapshotService } from './stock-price-snapshot.service';

@Injectable()
export class StocksService {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,

    @InjectRepository(StockDetail)
    private readonly stockDetailRepository: Repository<StockDetail>,

    @InjectRepository(StockPriceDaily)
    private readonly stockPriceDailyRepository: Repository<StockPriceDaily>,

    @InjectRepository(StockInvestmentIndicator)
    private readonly stockInvestmentIndicatorRepository: Repository<StockInvestmentIndicator>,

    private readonly kiwoomWebSocketService: KiwoomWebSocketService,

    private readonly stockPriceSnapshotService: StockPriceSnapshotService,

    private readonly dartService: DartService,

    private readonly kiwoomAuthService: KiwoomAuthService,

    private readonly configService: ConfigService,
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
    const queryBuilder = this.createStockSearchQueryBuilder(query).orderBy(
      'stock.companyName',
      'ASC',
    );

    return queryBuilder.getMany();
  }

  async search(query: StockSearchQueryDto) {
    return this.findAll(query);
  }

  async findCurrentPrice(ticker: string) {
    const snapshot = await this.resolveCurrentPriceSnapshot(ticker);

    return {
      stockId: snapshot.stock.stockId,
      ticker: snapshot.stock.ticker,
      companyName: snapshot.stock.companyName,
      tradeDate: snapshot.latestPrice.tradeDate,
      currentPrice: snapshot.currentPrice,
      realtimePrice: snapshot.realtimePrice,
      previousClosePrice: snapshot.previousClosePrice,
      changePrice: snapshot.changePrice,
      changeRate: snapshot.changeRate,
      price: snapshot.latestPrice,
    };
  }

  async findSummary(ticker: string) {
    const stock = await this.findByTicker(ticker);
    const [latestPrice, previousPrice] =
      await this.stockPriceSnapshotService.findTwoLatestPricesByStock(
        stock.stockId,
      );
    const change =
      this.stockPriceSnapshotService.calculatePriceChangeFromPrices(
        latestPrice,
        previousPrice,
      );

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
        previousClosePrice: previousPrice?.closePrice ?? null,
        changePrice: change.changePrice,
        changeRate: change.changeRate,
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

  async findFinancials(ticker: string) {
    // DART에 사업보고서가 아직 없거나 종목코드가 매핑되지 않으면 빈 객체로 응답해
    // 프런트의 "재무 정보 없음" 처리로 자연스럽게 넘어가게 한다.
    try {
      return await this.dartService.getFinancialSummary(ticker);
    } catch {
      return {};
    }
  }

  /**
   * 네이버 금융이 쓰는 와이즈리포트(WiseReport) 기업개요 페이지에서
   * "주요제품 매출구성" 표를 가져옵니다. DART Open API엔 이 데이터가 없어
   * 같은 데이터를 쓰는 와이즈리포트 공개 페이지를 대신 이용합니다.
   */
  async findRevenueComposition(ticker: string) {
    try {
      const response = await axios.get<string>(
        'https://navercomp.wisereport.co.kr/v2/company/c1020001.aspx',
        {
          params: { cmp_cd: ticker },
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Referer: 'https://finance.naver.com/',
          },
          timeout: 10000,
        },
      );

      const html = response.data;
      const tableMatch = html.match(/id="cTB203"[\s\S]*?<\/table>/);

      if (!tableMatch) {
        return { ticker, period: null, items: [] };
      }

      const rowPattern = /title="([^"]*)"[^>]*>[\s\S]*?<td[^>]*>([^<]*)<\/td>/g;
      const items = [...tableMatch[0].matchAll(rowPattern)]
        .map(([, nameRaw, ratioRaw]) => ({
          name: nameRaw.replace(/&nbsp;/g, '').trim(),
          ratio: Number(ratioRaw.replace(/&nbsp;/g, '').replace(/[^0-9.-]/g, '')),
        }))
        .filter((item) => item.name && Number.isFinite(item.ratio) && item.ratio !== 0);

      const periodMatch = html.match(/주요제품\s*매출구성\(([^)]+)\)/);

      return {
        ticker,
        period: periodMatch ? periodMatch[1].trim() : null,
        items,
      };
    } catch {
      return { ticker, period: null, items: [] };
    }
  }

  /**
   * 키움 REST API ka10059(종목별투자자기관별요청)로 외국인/기관/개인 순매수 동향을 조회합니다.
   */
  async findInvestorTrend(ticker: string, date?: string) {
    const host =
      this.configService.get<string>('KIWOOM_API_HOST') ??
      'https://api.kiwoom.com';
    const token = await this.kiwoomAuthService.getAccessToken();

    const today = new Date();
    const dt =
      date ??
      `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const response = await axios.post(
      `${host}/api/dostk/stkinfo`,
      {
        dt,
        stk_cd: ticker,
        amt_qty_tp: '1', // 1: 금액
        trde_tp: '0', // 0: 순매수
        unit_tp: '1000', // 천주/천원 단위
      },
      {
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          authorization: `Bearer ${token}`,
          'api-id': 'ka10059',
          'cont-yn': 'N',
          'next-key': '',
        },
      },
    );

    if (response.data?.return_code !== 0) {
      throw new InternalServerErrorException(
        `키움 투자자 동향 조회 실패: ${response.data?.return_msg}`,
      );
    }

    const rows = response.data?.stk_invsr_orgn ?? [];
    // amt_qty_tp: '1'(금액) + unit_tp: '1000'(천원 단위) 조합이라 원 단위로 환산
    const toWon = (value: string) => Number(value ?? '0') * 1000;

    const days = rows
      .map((row: Record<string, string>) => ({
        date: row.dt,
        individualNet: toWon(row.ind_invsr),
        foreignNet: toWon(row.frgnr_invsr),
        institutionNet: toWon(row.orgn),
        institutionDetail: {
          financialInvestment: toWon(row.fnnc_invt),
          insurance: toWon(row.insrnc),
          investmentTrust: toWon(row.invtrt),
          otherFinance: toWon(row.etc_fnnc),
          bank: toWon(row.bank),
          pensionFund: toWon(row.penfnd_etc),
          privateFund: toWon(row.samo_fund),
          nation: toWon(row.natn),
          otherCorp: toWon(row.etc_corp),
        },
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { ticker, days };
  }

  async findIndicators(ticker: string) {
    const stock = await this.findByTicker(ticker);
    const [latestPrice, previousPrice] =
      await this.stockPriceSnapshotService.findTwoLatestPricesByStock(
        stock.stockId,
      );
    const change =
      this.stockPriceSnapshotService.calculatePriceChangeFromPrices(
        latestPrice,
        previousPrice,
      );
    const currentPrice = this.stockPriceSnapshotService.toNumberOrNull(
      latestPrice?.closePrice,
    );
    const marketCap = this.stockPriceSnapshotService.toNumberOrNull(
      stock.detail?.marketCap,
    );
    const totalShares = this.stockPriceSnapshotService.toNumberOrNull(
      stock.detail?.totalShares,
    );
    const marketCapFromPrice =
      currentPrice !== null && totalShares !== null
        ? currentPrice * totalShares
        : null;
    const latestIndicator = await this.findLatestInvestmentIndicator(
      stock.stockId,
    );

    return {
      stockId: stock.stockId,
      ticker: stock.ticker,
      companyName: stock.companyName,
      tradeDate: latestPrice?.tradeDate ?? null,
      currentPrice: latestPrice?.closePrice ?? null,
      previousClosePrice: previousPrice?.closePrice ?? null,
      changePrice: change.changePrice,
      changeRate: change.changeRate,
      marketCap: stock.detail?.marketCap ?? null,
      totalShares: stock.detail?.totalShares ?? null,
      estimatedMarketCap:
        marketCap !== null
          ? marketCap.toString()
          : marketCapFromPrice !== null
            ? Math.round(marketCapFromPrice).toString()
            : null,
      indicators: {
        per: latestIndicator?.per ?? null,
        pbr: latestIndicator?.pbr ?? null,
        eps: latestIndicator?.eps ?? null,
        bps: latestIndicator?.bps ?? null,
        roe: latestIndicator?.roe ?? null,
        dividendYield: latestIndicator?.dividendYield ?? null,
        dps: latestIndicator?.dps ?? null,
      },
      indicatorTradeDate: latestIndicator?.tradeDate ?? null,
      indicatorSource: latestIndicator?.source ?? null,
      dataAvailability: {
        marketCap:
          stock.detail?.marketCap !== null &&
          stock.detail?.marketCap !== undefined,
        totalShares:
          stock.detail?.totalShares !== null &&
          stock.detail?.totalShares !== undefined,
        financialIndicators: latestIndicator
          ? this.hasInvestmentIndicatorValue(latestIndicator)
          : false,
      },
    };
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

    if (query.startDate && query.endDate && query.startDate > query.endDate) {
      throw new BadRequestException(
        '시작 날짜는 종료 날짜보다 늦을 수 없습니다.',
      );
    }

    const prices = await this.findPricesByStock(stock.stockId, query, 'DESC');

    return {
      stockId: stock.stockId,
      ticker: stock.ticker,
      companyName: stock.companyName,
      prices,
    };
  }

  private async findLatestAndPreviousDailyPrice(ticker: string) {
    const stock = await this.findByTicker(ticker);
    const [latestPrice, previousPrice] =
      await this.stockPriceSnapshotService.findTwoLatestPricesByStock(
        stock.stockId,
      );

    if (!latestPrice) {
      throw new NotFoundException('종목 시세를 찾을 수 없습니다.');
    }

    return {
      stock,
      latestPrice,
      previousPrice,
      change:
        this.stockPriceSnapshotService.calculatePriceChangeFromPrices(
          latestPrice,
          previousPrice,
        ),
    };
  }

  private async findLatestInvestmentIndicator(stockId: number) {
    return this.stockInvestmentIndicatorRepository.findOne({
      where: {
        stockId,
      },
      order: {
        tradeDate: 'DESC',
      },
    });
  }

  private hasInvestmentIndicatorValue(indicator: StockInvestmentIndicator) {
    return [
      indicator.per,
      indicator.pbr,
      indicator.eps,
      indicator.bps,
      indicator.roe,
      indicator.dividendYield,
      indicator.dps,
    ].some((value) => value !== null && value !== undefined);
  }

  async findLatestDailyPrice(ticker: string) {
    const { stock, latestPrice, previousPrice, change } =
      await this.findLatestAndPreviousDailyPrice(ticker);

    return {
      stockId: stock.stockId,
      ticker: stock.ticker,
      companyName: stock.companyName,
      price: latestPrice,
      previousClosePrice: previousPrice?.closePrice ?? null,
      changePrice: change.changePrice,
      changeRate: change.changeRate,
    };
  }

  private async resolveCurrentPriceSnapshot(ticker: string) {
    const stock = await this.findByTicker(ticker);
    const snapshot =
      await this.stockPriceSnapshotService.buildCurrentPriceSnapshot({
        stockId: stock.stockId,
        ticker: stock.ticker,
        requireLatestPrice: true,
        latestPriceNotFoundMessage:
          '종목 시세를 찾을 수 없습니다.',
      });

    return {
      stock,
      latestPrice: snapshot.latestPrice!,
      previousPrice: snapshot.previousPrice,
      currentPrice: snapshot.currentPrice,
      realtimePrice: snapshot.realtimePrice,
      previousClosePrice: snapshot.previousClosePrice,
      changePrice: snapshot.changePrice,
      changeRate: snapshot.changeRate,
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
    if (query.startDate && query.endDate && query.startDate > query.endDate) {
      throw new BadRequestException(
        '시작 날짜는 종료 날짜보다 늦을 수 없습니다.',
      );
    }

    const queryOrder = order === 'ASC' && query.limit ? 'DESC' : order;
    const queryBuilder = this.stockPriceDailyRepository
      .createQueryBuilder('price')
      .where('price.stockId = :stockId', {
        stockId,
      })
      .orderBy('price.tradeDate', queryOrder);

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

    const prices = await queryBuilder.getMany();

    return queryOrder === order ? prices : prices.reverse();
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
    const orderBy = type === 'volume' ? 'latest.volume' : 'changeRate';
    const orderDirection = type === 'fall' ? 'ASC' : 'DESC';

    // stock_id별 MAX(trade_date)를 종목마다 상관 서브쿼리로 구하면(예전 방식)
    // 2700여 종목 x 종목당 수백~수천 행을 매번 스캔해 20초 넘게 걸림 — 프런트 axios
    // 기본 타임아웃(5s)을 넘겨 랭킹이 아예 안 뜨는 원인이었음.
    // ROW_NUMBER 윈도우 함수로 한 번에 순위를 매기는 방식으로 바꿔서 0.5초대로 단축.
    // ponytail: 최근 60일 내 거래가 없는 종목은 전일 종가를 못 찾아 상승/하락 랭킹에서
    // 빠짐(거래량 랭킹은 영향 없음) — 60일 넘게 거래정지된 종목까지 반영해야 하면
    // INTERVAL 값을 늘리되 성능 재확인 필요.
    const requirePreviousClose = type !== 'volume';

    const rows = await this.stockRepository.manager.query(
      `
      WITH ranked AS (
        SELECT
          stock_id, trade_date, open_price, high_price, low_price, close_price, volume,
          ROW_NUMBER() OVER (PARTITION BY stock_id ORDER BY trade_date DESC) AS rn
        FROM stock_price_daily
        WHERE trade_date >= (CURDATE() - INTERVAL 60 DAY)
      )
      SELECT
        s.stock_id AS stockId,
        s.ticker AS ticker,
        s.company_name AS companyName,
        s.market AS market,
        s.sector AS sector,
        latest.trade_date AS tradeDate,
        latest.open_price AS openPrice,
        latest.high_price AS highPrice,
        latest.low_price AS lowPrice,
        latest.close_price AS closePrice,
        latest.volume AS volume,
        previous.close_price AS previousClosePrice,
        CASE
          WHEN previous.close_price IS NULL OR previous.close_price = 0 THEN NULL
          ELSE ((latest.close_price - previous.close_price) / previous.close_price) * 100
        END AS changeRate
      FROM stocks s
      JOIN ranked latest ON latest.stock_id = s.stock_id AND latest.rn = 1
      LEFT JOIN ranked previous ON previous.stock_id = s.stock_id AND previous.rn = 2
      WHERE s.is_active = 1
        ${requirePreviousClose ? 'AND previous.close_price IS NOT NULL' : ''}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT ?
      `,
      [normalizedLimit],
    );

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
    const price = await this.kiwoomWebSocketService.getCurrentPrice(stockCode);
    const stock = await this.findByTicker(stockCode);
    const [latestPrice] =
      await this.stockPriceSnapshotService.findTwoLatestPricesByStock(
        stock.stockId,
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
        '현재가 정보가 없습니다. 먼저 실시간 구독을 요청해야 합니다.',
      );
    }

    return {
      stockCode,
      ticker: stockCode,
      price,
      currentPrice: price,
      previousClosePrice,
      changePrice: change.changePrice,
      changeRate: change.changeRate,
    };
  }

  getAllCurrentPrices() {
    return this.kiwoomWebSocketService.getAllCurrentPrices();
  }

  // 틱 단위 실시간 시세 스트림. previousClosePrice는 장중에 안 바뀌므로 스트림
  // 시작 시 한 번만 조회하고, 이후 틱마다 등락은 메모리에서 계산해 DB를 다시 안 친다.
  streamCurrentPrice(ticker: string): Observable<MessageEvent> {
    return from(this.getStreamContext(ticker)).pipe(
      mergeMap(({ previousClosePrice, initialPrice }) => {
        const toEvent = (price: number): MessageEvent => {
          const change = this.stockPriceSnapshotService.calculatePriceChange(
            price,
            previousClosePrice,
          );

          return {
            data: {
              stockCode: ticker,
              ticker,
              price,
              currentPrice: price,
              previousClosePrice,
              changePrice: change.changePrice,
              changeRate: change.changeRate,
            },
          };
        };

        const ticks$ = fromEvent<StockTick>(
          this.kiwoomWebSocketService,
          'tick',
        ).pipe(
          filter((tick) => tick.stockCode === ticker),
          map((tick) => toEvent(tick.price)),
        );

        return initialPrice === null
          ? ticks$
          : concat(of(toEvent(initialPrice)), ticks$);
      }),
    );
  }

  private async getStreamContext(ticker: string) {
    const stock = await this.findByTicker(ticker);
    const [latestPrice] =
      await this.stockPriceSnapshotService.findTwoLatestPricesByStock(
        stock.stockId,
      );
    const previousClosePrice = this.stockPriceSnapshotService.toNumberOrNull(
      latestPrice?.closePrice,
    );
    const initialPrice =
      await this.kiwoomWebSocketService.getCurrentPrice(ticker);

    return { previousClosePrice, initialPrice };
  }
}
