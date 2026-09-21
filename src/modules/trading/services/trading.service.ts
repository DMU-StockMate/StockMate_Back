import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { EntityManager, In, Repository } from 'typeorm';
import { KiwoomWebSocketService } from '../../kiwoom/services/kiwoom-websocket.service';
import { KiwoomAuthService } from '../../kiwoom/services/kiwoom-auth.service';
import { StockPriceDaily } from '../../stocks/entities/stock-price-daily.entity';
import { Stock, StockStatus } from '../../stocks/entities/stock.entity';
import { NotificationType } from '../../notification/entities/notification.entity';
import { NotificationService } from '../../notification/services/notification.service';
import { CreateTradeDto } from '../dto/create-trade.dto';
import { RankingQueryDto } from '../dto/ranking-query.dto';
import { TradeHistoryQueryDto } from '../dto/trade-history-query.dto';
import { AccountAssetSnapshot } from '../entities/account-asset-snapshot.entity';
import {
  AccountCashHistory,
  CashHistoryType,
} from '../entities/account-cash-history.entity';
import { Holding } from '../entities/holding.entity';
import {
  InvestmentOrder,
  OrderSide,
  OrderStatus,
  OrderType,
  TradingVenue,
} from '../entities/investment-order.entity';
import { MarketHoliday } from '../entities/market-holiday.entity';
import { StockTradingVenue } from '../entities/stock-trading-venue.entity';
import { Trade, TradeType } from '../entities/trade.entity';
import { TradingAccount } from '../entities/trading-account.entity';

const INITIAL_CASH_BALANCE = 30000000;

@Injectable()
export class TradingService implements OnModuleInit {
  private readonly logger = new Logger(TradingService.name);
  private scheduledOrderTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(TradingAccount)
    private readonly accountRepository: Repository<TradingAccount>,

    @InjectRepository(Holding)
    private readonly holdingRepository: Repository<Holding>,

    @InjectRepository(InvestmentOrder)
    private readonly orderRepository: Repository<InvestmentOrder>,

    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,

    @InjectRepository(AccountCashHistory)
    private readonly cashHistoryRepository: Repository<AccountCashHistory>,

    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,

    @InjectRepository(StockPriceDaily)
    private readonly stockPriceDailyRepository: Repository<StockPriceDaily>,

    private readonly kiwoomWebSocketService: KiwoomWebSocketService,

    @InjectRepository(AccountAssetSnapshot)
    private readonly assetSnapshotRepository: Repository<AccountAssetSnapshot>,

    @InjectRepository(MarketHoliday)
    private readonly marketHolidayRepository: Repository<MarketHoliday>,

    @InjectRepository(StockTradingVenue)
    private readonly stockTradingVenueRepository: Repository<StockTradingVenue>,

    private readonly configService: ConfigService,
    private readonly kiwoomAuthService: KiwoomAuthService,

    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit() {
    this.kiwoomWebSocketService.registerPriceListener((stockCode, price) => {
      void this.processPrice(stockCode, price);
    });
    this.scheduledOrderTimer = setInterval(() => {
      void this.processTimedOrders();
    }, 30_000);
    this.scheduledOrderTimer.unref?.();
  }

  async findAccount(userId: number) {
    const account = await this.ensureAccount(userId);
    account.totalAssetValue = await this.calculateTotalAssetValue(
      this.accountRepository.manager,
      account.accountId,
      account.cashBalance,
    );
    await this.accountRepository.save(account);

    return {
      accountId: account.accountId,
      userId: account.userId,
      seedMoney: account.seedMoney,
      cashBalance: account.cashBalance,
      totalAssetValue: account.totalAssetValue,
    };
  }

  async findHoldings(userId: number) {
    const account = await this.ensureAccount(userId);
    const holdings = await this.holdingRepository.find({
      where: { accountId: account.accountId },
      relations: { stock: true },
      order: { updatedAt: 'DESC' },
    });

    return Promise.all(
      holdings.map(async (holding) => {
        const averagePrice = Number(holding.avgBuyPrice);
        const currentPrice = await this.resolveValuationPrice(
          this.holdingRepository.manager,
          holding,
        );
        const marketValue = currentPrice * holding.quantity;
        const purchaseValue = averagePrice * holding.quantity;
        const profitLoss = marketValue - purchaseValue;
        const profitRate =
          purchaseValue > 0 ? (profitLoss / purchaseValue) * 100 : 0;

        return {
          holdingId: holding.holdingId,
          accountId: holding.accountId,
          stockId: holding.stockId,
          ticker: holding.stock.ticker,
          companyName: holding.stock.companyName,
          quantity: holding.quantity,
          averagePrice: holding.avgBuyPrice,
          currentPrice: this.toDecimal(currentPrice),
          marketValue: this.toDecimal(marketValue),
          profitLoss: this.toDecimal(profitLoss),
          profitRate: profitRate.toFixed(2),
          updatedAt: holding.updatedAt,
        };
      }),
    );
  }

  async findAssetHistory(userId: number, days: number) {
    const account = await this.ensureAccount(userId);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await this.assetSnapshotRepository.find({
      where: {
        accountId: account.accountId,
      },
      order: {
        snapshotDate: 'ASC',
      },
    });

    const sinceDate = since.toISOString().slice(0, 10);

    return snapshots
      .filter((snapshot) => snapshot.snapshotDate >= sinceDate)
      .map((snapshot) => ({
        date: snapshot.snapshotDate,
        cashBalance: snapshot.cashBalance,
        stockValue: snapshot.stockValue,
        totalAssetValue: snapshot.totalAssetValue,
      }));
  }

  async findTrades(userId: number, query: TradeHistoryQueryDto) {
    const account = await this.ensureAccount(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.tradeRepository.findAndCount({
      where: { accountId: account.accountId },
      relations: { stock: true },
      order: { tradedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((trade) => this.toTradeResponse(trade)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOrders(userId: number) {
    const account = await this.ensureAccount(userId);
    const orders = await this.orderRepository.find({
      where: { accountId: account.accountId },
      order: { createdAt: 'DESC' },
    });

    return orders.map((order) => this.toOrderResponse(order));
  }

  async findAssetRankings(query: RankingQueryDto) {
    const limit = query.limit ?? 20;
    const rows = await this.accountRepository
      .createQueryBuilder('account')
      .innerJoin('users', 'user', 'user.user_id = account.user_id')
      .select('account.user_id', 'userId')
      .addSelect('user.nickname', 'nickname')
      .addSelect('user.profile_image_url', 'profileImageUrl')
      .addSelect('account.total_asset_value', 'totalAssetValue')
      .addSelect('account.cash_balance', 'cashBalance')
      .addSelect('account.seed_money', 'seedMoney')
      .where('user.status = :status', { status: 'ACTIVE' })
      .andWhere(
        'account.account_id = (SELECT MAX(latest_account.account_id) FROM simulation_accounts latest_account WHERE latest_account.user_id = account.user_id)',
      )
      .orderBy('account.total_asset_value', 'DESC')
      .addOrderBy('account.updated_at', 'ASC')
      .limit(limit)
      .getRawMany();

    return rows.map((row, index) => ({
      rank: index + 1,
      userId: Number(row.userId),
      nickname: row.nickname,
      profileImageUrl: row.profileImageUrl,
      totalAssetValue: row.totalAssetValue,
      cashBalance: row.cashBalance,
      seedMoney: row.seedMoney,
    }));
  }

  async findWeeklyGrowthRankings(query: RankingQueryDto) {
    const limit = query.limit ?? 20;
    const rows = await this.accountRepository
      .createQueryBuilder('account')
      .innerJoin('users', 'user', 'user.user_id = account.user_id')
      .select('account.user_id', 'userId')
      .addSelect('user.nickname', 'nickname')
      .addSelect('user.profile_image_url', 'profileImageUrl')
      .addSelect('account.total_asset_value', 'totalAssetValue')
      .addSelect('account.seed_money', 'seedMoney')
      .addSelect(
        'account.total_asset_value - account.seed_money',
        'growthAmount',
      )
      .addSelect(
        'IF(account.seed_money = 0, 0, (account.total_asset_value - account.seed_money) / account.seed_money * 100)',
        'growthRate',
      )
      .where('user.status = :status', { status: 'ACTIVE' })
      .andWhere(
        'account.account_id = (SELECT MAX(latest_account.account_id) FROM simulation_accounts latest_account WHERE latest_account.user_id = account.user_id)',
      )
      .andWhere('account.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
      .orderBy('growthAmount', 'DESC')
      .addOrderBy('account.total_asset_value', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((row, index) => ({
      rank: index + 1,
      userId: Number(row.userId),
      nickname: row.nickname,
      profileImageUrl: row.profileImageUrl,
      totalAssetValue: row.totalAssetValue,
      seedMoney: row.seedMoney,
      growthAmount: this.toDecimal(Number(row.growthAmount)),
      growthRate: Number(row.growthRate).toFixed(2),
    }));
  }

  async buy(userId: number, dto: CreateTradeDto) {
    const result = await this.placeOrder(userId, dto, OrderSide.BUY);
    await this.notifyIfFilled(userId, result);
    return result;
  }

  async sell(userId: number, dto: CreateTradeDto) {
    const result = await this.placeOrder(userId, dto, OrderSide.SELL);
    await this.notifyIfFilled(userId, result);
    return result;
  }

  async cancelOrder(userId: number, orderId: string) {
    return this.accountRepository.manager.transaction(async (manager) => {
      const order = await manager.findOne(InvestmentOrder, {
        where: { orderId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('주문을 찾을 수 없습니다.');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException('대기 중인 주문만 취소할 수 있습니다.');
      }

      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
      await manager.save(InvestmentOrder, order);

      this.logger.log(
        `order cancelled userId=${userId} stockCode=${order.stockCode} side=${order.side} orderType=${order.orderType} quantity=${order.quantity}`,
      );

      return this.toOrderResponse(order);
    });
  }

  async processPrice(stockCode: string, currentPrice: number) {
    if (!this.isValidPrice(currentPrice)) return;

    // Uses the unified simulation price. Venue checks below decide whether each
    // pending order can trade in its requested session.
    const stock = await this.stockRepository.findOne({
      where: {
        ticker: stockCode,
        status: StockStatus.ACTIVE,
        isActive: true,
      },
    });
    if (!stock) return;

    const pendingOrders = await this.orderRepository.find({
      where: {
        stockId: stock.stockId,
        status: OrderStatus.PENDING,
        orderType: In([
          OrderType.LIMIT,
          OrderType.STOP_LIMIT,
          OrderType.CONDITIONAL_LIMIT,
        ]),
      },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    for (const order of pendingOrders) {
      if (!(await this.isTradingVenueAvailable(stock, order.tradingVenue))) {
        continue;
      }

      if (
        !(await this.isRegularMarketOpen(stock.market, order.tradingVenue))
      ) {
        continue;
      }

      if (order.orderType === OrderType.STOP_LIMIT) {
        if (!this.canTriggerStopOrder(order, currentPrice)) {
          continue;
        }

        const result = await this.triggerStopLimitOrder(
          order.orderId,
          currentPrice,
        );
        await this.notifyIfFilled(order.userId, result);
        continue;
      }

      if (this.canFillLimitOrder(order, currentPrice)) {
        const result = await this.fillPendingOrder(order.orderId, currentPrice);
        await this.notifyIfFilled(order.userId, result);
      }
    }
  }

  async processTimedOrders() {
    await this.processScheduledOrders();

    if (await this.isConditionalLimitCloseSession()) {
      await this.processConditionalLimitCloseOrders();
    }
  }

  private validateAdvancedOrderRequest(
    dto: CreateTradeDto,
    orderType: OrderType,
  ) {
    if (
      [OrderType.LIMIT, OrderType.STOP_LIMIT, OrderType.CONDITIONAL_LIMIT].includes(
        orderType,
      ) &&
      !this.isValidPrice(dto.price)
    ) {
      throw new BadRequestException('A positive price is required.');
    }

    if (orderType === OrderType.STOP_LIMIT && !this.isValidPrice(dto.stopPrice)) {
      throw new BadRequestException('A positive stopPrice is required.');
    }

    if (orderType !== OrderType.RESERVATION) {
      return;
    }

    const executionOrderType = this.resolveReservationExecutionType(dto);
    this.parseScheduledAt(dto.scheduledAt);

    if (
      executionOrderType === OrderType.LIMIT &&
      !this.isValidPrice(dto.price)
    ) {
      throw new BadRequestException('LIMIT reservation requires price.');
    }
  }

  private resolveReservationExecutionType(dto: CreateTradeDto) {
    const executionOrderType = dto.executionOrderType;
    if (
      !executionOrderType ||
      ![
        OrderType.MARKET,
        OrderType.LIMIT,
        OrderType.AFTER_HOURS_CLOSE,
      ].includes(executionOrderType)
    ) {
      throw new BadRequestException(
        'RESERVATION supports MARKET, LIMIT, or AFTER_HOURS_CLOSE executionOrderType.',
      );
    }

    return executionOrderType;
  }

  private parseScheduledAt(value: string | undefined) {
    if (!value) {
      throw new BadRequestException('RESERVATION requires scheduledAt.');
    }

    const scheduledAt = new Date(value);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt must be a valid date.');
    }

    return scheduledAt;
  }

  private async createReservationOrder(
    userId: number,
    stock: Stock,
    side: OrderSide,
    dto: CreateTradeDto,
  ) {
    const scheduledAt = this.parseScheduledAt(dto.scheduledAt);
    const executionOrderType = this.resolveReservationExecutionType(dto);
    const tradingVenue = this.resolveTradingVenue(dto.tradingVenue);
    await this.assertTradingVenueAvailable(stock, tradingVenue);
    this.assertReservationOrderEntrySession();
    let reservationPrice = dto.price ?? 0;

    if (executionOrderType === OrderType.MARKET) {
      reservationPrice = await this.resolveServerCurrentPrice(stock.ticker);
    } else if (executionOrderType === OrderType.AFTER_HOURS_CLOSE) {
      reservationPrice = await this.resolveTodayClosePrice(stock);
    }

    return this.createPendingLimitOrder(
      userId,
      stock,
      side,
      dto.quantity,
      reservationPrice,
      OrderType.RESERVATION,
      null,
      {
        executionOrderType,
        scheduledAt,
        tradingVenue,
        reservedAmount:
          side === OrderSide.BUY ? reservationPrice * dto.quantity : 0,
      },
    );
  }

  private async processScheduledOrders() {
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.status = :status', { status: OrderStatus.PENDING })
      .andWhere('order.order_type = :orderType', {
        orderType: OrderType.RESERVATION,
      })
      .andWhere('order.scheduled_at <= :now', { now: new Date() })
      .orderBy('order.scheduled_at', 'ASC')
      .take(50)
      .getMany();

    for (const order of orders) {
      try {
        const result = await this.executeReservationOrder(order.orderId);
        await this.notifyIfFilled(order.userId, result);
      } catch (error) {
        this.logger.warn(
          `reservation order processing failed orderId=${order.orderId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async executeReservationOrder(orderId: string) {
    return this.accountRepository.manager.transaction(async (manager) => {
      const order = await manager.findOne(InvestmentOrder, {
        where: {
          orderId,
          status: OrderStatus.PENDING,
          orderType: OrderType.RESERVATION,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) return null;

      const stock = await manager.findOne(Stock, {
        where: {
          stockId: order.stockId,
          status: StockStatus.ACTIVE,
          isActive: true,
        },
      });
      if (!stock) {
        order.status = OrderStatus.REJECTED;
        await manager.save(InvestmentOrder, order);
        return null;
      }

      const account = await this.ensureAccountForUpdate(manager, order.userId);
      const executionOrderType = order.executionOrderType ?? OrderType.MARKET;

      if (executionOrderType === OrderType.LIMIT) {
        if (
          !(await this.isRegularMarketOpen(stock.market, order.tradingVenue))
        ) {
          return this.toOrderPlacementResponse(order, null, null, null);
        }

        const currentPrice = await this.resolveServerCurrentPrice(stock.ticker);
        order.orderType = OrderType.LIMIT;
        await manager.save(InvestmentOrder, order);

        if (!this.canFillLimitOrder(order, currentPrice)) {
          return this.toOrderPlacementResponse(order, null, null, null);
        }

        return order.side === OrderSide.BUY
          ? this.fillBuyOrder(manager, account, stock, order, currentPrice)
          : this.fillSellOrder(manager, account, stock, order, currentPrice);
      }

      if (
        executionOrderType === OrderType.MARKET &&
        !(await this.isRegularMarketOpen(stock.market, order.tradingVenue))
      ) {
        return this.toOrderPlacementResponse(order, null, null, null);
      }

      if (
        executionOrderType === OrderType.AFTER_HOURS_CLOSE &&
        !(await this.isAfterHoursCloseSession(stock.market, order.tradingVenue))
      ) {
        return this.toOrderPlacementResponse(order, null, null, null);
      }

      const executionPrice =
        executionOrderType === OrderType.AFTER_HOURS_CLOSE
          ? await this.resolveTodayClosePrice(stock)
          : await this.resolveServerCurrentPrice(stock.ticker);

      order.executionOrderType = executionOrderType;
      return order.side === OrderSide.BUY
        ? this.fillBuyOrder(manager, account, stock, order, executionPrice)
        : this.fillSellOrder(manager, account, stock, order, executionPrice);
    });
  }

  private async processConditionalLimitCloseOrders() {
    const orders = await this.orderRepository.find({
      where: {
        status: OrderStatus.PENDING,
        orderType: OrderType.CONDITIONAL_LIMIT,
      },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    for (const order of orders) {
      if (order.tradingVenue !== TradingVenue.KRX) {
        continue;
      }

      try {
        const executionPrice = await this.resolveServerCurrentPrice(
          order.stockCode,
        );
        const result = await this.fillPendingOrderAtMarket(
          order.orderId,
          executionPrice,
        );
        await this.notifyIfFilled(order.userId, result);
      } catch (error) {
        this.logger.warn(
          `conditional limit close processing failed orderId=${order.orderId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  async creditReward(userId: number, amount: number, refId: number | string) {
    if (amount <= 0) return;

    return this.accountRepository.manager.transaction(async (manager) => {
      const account = await this.ensureAccountForUpdate(manager, userId);

      account.cashBalance = this.toDecimal(Number(account.cashBalance) + amount);
      account.totalAssetValue = await this.calculateTotalAssetValue(
        manager,
        account.accountId,
        account.cashBalance,
      );
      await manager.save(TradingAccount, account);
      await this.saveCashHistory(
        manager,
        account,
        CashHistoryType.REWARD,
        amount,
        'QUIZ_ATTEMPT',
        String(refId),
      );

      return {
        cashBalance: account.cashBalance,
        totalAssetValue: account.totalAssetValue,
      };
    });
  }

  async syncNxtTradingVenues(options: {
    limit?: number;
    offset?: number;
    delayMs?: number;
  }) {
    const requestedLimit = Number.isFinite(options.limit) ? options.limit : 300;
    const requestedOffset = Number.isFinite(options.offset) ? options.offset : 0;
    const requestedDelayMs = Number.isFinite(options.delayMs)
      ? options.delayMs
      : 250;
    const limit = Math.min(Math.max(requestedLimit ?? 300, 1), 3000);
    const offset = Math.max(requestedOffset ?? 0, 0);
    const delayMs = Math.max(requestedDelayMs ?? 250, 0);

    const stocks = await this.stockRepository.find({
      where: {
        status: StockStatus.ACTIVE,
        isActive: true,
        market: In(['KOSPI', 'KOSDAQ']),
      },
      order: { stockId: 'ASC' },
      skip: offset,
      take: limit,
    });

    let enabled = 0;
    let disabled = 0;
    let failed = 0;
    const failures: Array<{ ticker: string; message: string }> = [];

    for (const stock of stocks) {
      try {
        const isAvailable = await this.checkNxtAvailabilityByKiwoom(
          stock.ticker,
        );

        await this.stockTradingVenueRepository.save(
          this.stockTradingVenueRepository.create({
            stockId: stock.stockId,
            tradingVenue: TradingVenue.NXT,
            isActive: isAvailable,
          }),
        );

        if (isAvailable) {
          enabled += 1;
        } else {
          disabled += 1;
        }
      } catch (error) {
        failed += 1;
        failures.push({
          ticker: stock.ticker,
          message: error instanceof Error ? error.message : String(error),
        });
      }

      if (delayMs > 0) {
        await this.delay(delayMs);
      }
    }

    return {
      checked: stocks.length,
      enabled,
      disabled,
      failed,
      offset,
      limit,
      delayMs,
      failures: failures.slice(0, 20),
    };
  }

  private async notifyIfFilled(
    userId: number,
    result: ReturnType<TradingService['toOrderPlacementResponse']> | null,
  ) {
    if (!result?.order || result.order.status !== OrderStatus.FILLED) {
      return;
    }

    const trade = result.trade as
      | {
          tradeType?: TradeType;
          ticker?: string;
          companyName?: string;
          quantity?: number;
        }
      | null
      | undefined;

    if (!trade?.tradeType) {
      return;
    }

    const isBuy = trade.tradeType === TradeType.BUY;
    const action = isBuy ? '매수' : '매도';

    await this.notificationService.create(
      userId,
      NotificationType.TRADE_EXECUTED,
      `${action} 체결 완료`,
      `${trade.companyName ?? result.order.stockCode} ${trade.quantity ?? result.order.quantity}주 ${action}가 체결되었습니다.`,
      `/trade/stocks/${trade.ticker ?? result.order.stockCode}`,
    );
  }

  private async placeOrder(
    userId: number,
    dto: CreateTradeDto,
    side: OrderSide,
  ) {
    const stockCode = this.resolveStockCode(dto);
    const orderType = dto.orderType ?? OrderType.MARKET;
    const tradingVenue = this.resolveTradingVenue(dto.tradingVenue);

    if (dto.side && dto.side !== side) {
      throw new BadRequestException('Request side does not match route side.');
    }

    this.validateAdvancedOrderRequest(dto, orderType);

    const stock = await this.findActiveStock(stockCode);
    await this.assertTradingVenueAvailable(stock, tradingVenue);

    if (orderType === OrderType.RESERVATION) {
      return this.createReservationOrder(userId, stock, side, dto);
    }

    if (orderType === OrderType.AFTER_HOURS_CLOSE) {
      await this.assertAfterHoursCloseSession(stock.market, tradingVenue);
      const executionPrice = await this.resolveTodayClosePrice(stock);
      return this.createAndFillOrder({
        userId,
        stock,
        side,
        orderType,
        quantity: dto.quantity,
        limitPrice: null,
        executionPrice,
        tradingVenue,
      });
    }

    const isRegularSession = await this.isRegularMarketOpen(
      stock.market,
      tradingVenue,
    );
    const isAcceptanceOnlySession =
      await this.isNxtAfterMarketOrderAcceptanceOnly(
        stock.market,
        tradingVenue,
      );

    if (!isRegularSession) {
      if (isAcceptanceOnlySession && orderType !== OrderType.MARKET) {
        return this.createPendingLimitOrder(
          userId,
          stock,
          side,
          dto.quantity,
          dto.price as number,
          orderType,
          orderType === OrderType.STOP_LIMIT ? (dto.stopPrice as number) : null,
          { tradingVenue },
        );
      }

      await this.assertRegularMarketSession(stock.market, tradingVenue);
    }

    const currentPrice = await this.resolveServerCurrentPrice(stock.ticker);

    if (orderType === OrderType.MARKET) {
      return this.createAndFillOrder({
        userId,
        stock,
        side,
        orderType,
        quantity: dto.quantity,
        limitPrice: null,
        executionPrice: currentPrice,
        tradingVenue,
      });
    }

    const limitPrice = dto.price as number;

    if (orderType === OrderType.STOP_LIMIT) {
      const pending = await this.createPendingLimitOrder(
        userId,
        stock,
        side,
        dto.quantity,
        limitPrice,
        OrderType.STOP_LIMIT,
        dto.stopPrice as number,
        { tradingVenue },
      );

      if (this.canTriggerStopValues(side, currentPrice, dto.stopPrice as number)) {
        return (
          (await this.triggerStopLimitOrder(
            pending.order.orderId,
            currentPrice,
          )) ?? pending
        );
      }

      return pending;
    }

    if (this.canFillLimitValues(side, currentPrice, limitPrice)) {
      return this.createAndFillOrder({
        userId,
        stock,
        side,
        orderType,
        quantity: dto.quantity,
        limitPrice,
        executionPrice: currentPrice,
        tradingVenue,
      });
    }

    return this.createPendingLimitOrder(
      userId,
      stock,
      side,
      dto.quantity,
      limitPrice,
      orderType,
      null,
      { tradingVenue },
    );
  }

  private async legacyPlaceOrder(
    userId: number,
    dto: CreateTradeDto,
    side: OrderSide,
  ) {
    const stockCode = this.resolveStockCode(dto);
    const orderType = dto.orderType ?? OrderType.MARKET;

    if (dto.side && dto.side !== side) {
      throw new BadRequestException('요청 경로와 주문 방향이 일치하지 않습니다.');
    }

    if (orderType === OrderType.LIMIT && !this.isValidPrice(dto.price)) {
      throw new BadRequestException('지정가 주문에는 1 이상의 price가 필요합니다.');
    }

    const stock = await this.findActiveStock(stockCode);
    const currentPrice = await this.resolveServerCurrentPrice(stock.ticker);

    if (orderType === OrderType.MARKET) {
      return this.createAndFillOrder({
        userId,
        stock,
        side,
        orderType,
        quantity: dto.quantity,
        limitPrice: null,
        executionPrice: currentPrice,
      });
    }

    const limitPrice = dto.price as number;
    if (this.canFillLimitValues(side, currentPrice, limitPrice)) {
      return this.createAndFillOrder({
        userId,
        stock,
        side,
        orderType,
        quantity: dto.quantity,
        limitPrice,
        executionPrice: currentPrice,
      });
    }

    return this.createPendingLimitOrder(
      userId,
      stock,
      side,
      dto.quantity,
      limitPrice,
    );
  }

  private async createPendingLimitOrder(
    userId: number,
    stock: Stock,
    side: OrderSide,
    quantity: number,
    limitPrice: number,
    orderType: OrderType = OrderType.LIMIT,
    stopPrice: number | null = null,
    options: {
      executionOrderType?: OrderType | null;
      scheduledAt?: Date | null;
      reservedAmount?: number | null;
      tradingVenue?: TradingVenue;
    } = {},
  ) {
    return this.accountRepository.manager.transaction(async (manager) => {
      const account = await this.ensureAccountForUpdate(manager, userId);
      const reservedAmount =
        options.reservedAmount ??
        (side === OrderSide.BUY ? limitPrice * quantity : 0);

      if (side === OrderSide.BUY) {
        const availableCash = await this.getAvailableCash(manager, account);
        if (availableCash < reservedAmount) {
          throw new BadRequestException('Available cash is not enough.');
        }
      } else {
        const sellableQuantity = await this.getSellableQuantity(
          manager,
          account.accountId,
          stock.stockId,
        );
        if (sellableQuantity < quantity) {
          throw new BadRequestException('Sellable quantity is not enough.');
        }
      }

      const order = await manager.save(
        InvestmentOrder,
        manager.create(InvestmentOrder, {
          accountId: account.accountId,
          userId,
          stockId: stock.stockId,
          stockCode: stock.ticker,
          tradingVenue: options.tradingVenue ?? TradingVenue.KRX,
          side,
          orderType,
          status: OrderStatus.PENDING,
          quantity,
          limitPrice: this.toDecimal(limitPrice),
          stopPrice: stopPrice === null ? null : this.toDecimal(stopPrice),
          executionOrderType: options.executionOrderType ?? null,
          scheduledAt: options.scheduledAt ?? null,
          reservedAmount: this.toDecimal(reservedAmount),
        }),
      );

      this.logger.log(
        `order pending userId=${userId} stockCode=${stock.ticker} venue=${options.tradingVenue ?? TradingVenue.KRX} side=${side} orderType=${orderType} quantity=${quantity} limitPrice=${limitPrice} stopPrice=${stopPrice ?? 'none'} scheduledAt=${options.scheduledAt?.toISOString() ?? 'none'}`,
      );

      return this.toOrderPlacementResponse(order, null, null, null);
    });
  }

  private async legacyCreatePendingLimitOrder(
    userId: number,
    stock: Stock,
    side: OrderSide,
    quantity: number,
    limitPrice: number,
  ) {
    return this.accountRepository.manager.transaction(async (manager) => {
      const account = await this.ensureAccountForUpdate(manager, userId);

      if (side === OrderSide.BUY) {
        const reservedAmount = limitPrice * quantity;
        const availableCash = await this.getAvailableCash(manager, account);
        if (availableCash < reservedAmount) {
          throw new BadRequestException('주문 가능 현금이 부족합니다.');
        }
      } else {
        const sellableQuantity = await this.getSellableQuantity(
          manager,
          account.accountId,
          stock.stockId,
        );
        if (sellableQuantity < quantity) {
          throw new BadRequestException('매도 가능 수량이 부족합니다.');
        }
      }

      const order = await manager.save(
        InvestmentOrder,
        manager.create(InvestmentOrder, {
          accountId: account.accountId,
          userId,
          stockId: stock.stockId,
          stockCode: stock.ticker,
          side,
          orderType: OrderType.LIMIT,
          status: OrderStatus.PENDING,
          quantity,
          limitPrice: this.toDecimal(limitPrice),
          reservedAmount:
            side === OrderSide.BUY
              ? this.toDecimal(limitPrice * quantity)
              : this.toDecimal(0),
        }),
      );

      this.logger.log(
        `order pending userId=${userId} stockCode=${stock.ticker} side=${side} orderType=LIMIT quantity=${quantity} limitPrice=${limitPrice}`,
      );

      return this.toOrderPlacementResponse(order, null, null, null);
    });
  }

  private async createAndFillOrder(params: {
    userId: number;
    stock: Stock;
    side: OrderSide;
    orderType: OrderType;
    quantity: number;
    limitPrice: number | null;
    executionPrice: number;
    tradingVenue?: TradingVenue;
  }) {
    return this.accountRepository.manager.transaction(async (manager) => {
      const account = await this.ensureAccountForUpdate(manager, params.userId);
      const order = await manager.save(
        InvestmentOrder,
        manager.create(InvestmentOrder, {
          accountId: account.accountId,
          userId: params.userId,
          stockId: params.stock.stockId,
          stockCode: params.stock.ticker,
          tradingVenue: params.tradingVenue ?? TradingVenue.KRX,
          side: params.side,
          orderType: params.orderType,
          status: OrderStatus.PENDING,
          quantity: params.quantity,
          limitPrice:
            params.limitPrice === null ? null : this.toDecimal(params.limitPrice),
          reservedAmount:
            params.side === OrderSide.BUY
              ? this.toDecimal((params.limitPrice ?? params.executionPrice) * params.quantity)
              : this.toDecimal(0),
        }),
      );

      const result =
        params.side === OrderSide.BUY
          ? await this.fillBuyOrder(manager, account, params.stock, order, params.executionPrice)
          : await this.fillSellOrder(manager, account, params.stock, order, params.executionPrice);

      this.logger.log(
        `order filled userId=${params.userId} stockCode=${params.stock.ticker} side=${params.side} orderType=${params.orderType} quantity=${params.quantity} limitPrice=${params.limitPrice ?? 'none'} executionPrice=${params.executionPrice}`,
      );

      return result;
    });
  }

  private async fillPendingOrder(orderId: string, executionPrice: number) {
    return this.accountRepository.manager.transaction(async (manager) => {
      const order = await manager.findOne(InvestmentOrder, {
        where: { orderId, status: OrderStatus.PENDING },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order || !this.canFillLimitOrder(order, executionPrice)) {
        return null;
      }

      const account = await this.ensureAccountForUpdate(manager, order.userId);
      const stock = await manager.findOne(Stock, {
        where: {
          stockId: order.stockId,
          status: StockStatus.ACTIVE,
          isActive: true,
        },
      });

      if (!stock) {
        order.status = OrderStatus.REJECTED;
        await manager.save(InvestmentOrder, order);
        return null;
      }

      try {
        return order.side === OrderSide.BUY
          ? await this.fillBuyOrder(
              manager,
              account,
              stock,
              order,
              executionPrice,
            )
          : await this.fillSellOrder(
              manager,
              account,
              stock,
              order,
              executionPrice,
            );
      } catch (error) {
        if (error instanceof BadRequestException) {
          return null;
        }

        throw error;
      }
    });
  }

  private async fillPendingOrderAtMarket(
    orderId: string,
    executionPrice: number,
  ) {
    return this.accountRepository.manager.transaction(async (manager) => {
      const order = await manager.findOne(InvestmentOrder, {
        where: { orderId, status: OrderStatus.PENDING },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) return null;

      const account = await this.ensureAccountForUpdate(manager, order.userId);
      const stock = await manager.findOne(Stock, {
        where: {
          stockId: order.stockId,
          status: StockStatus.ACTIVE,
          isActive: true,
        },
      });

      if (!stock) {
        order.status = OrderStatus.REJECTED;
        await manager.save(InvestmentOrder, order);
        return null;
      }

      try {
        return order.side === OrderSide.BUY
          ? await this.fillBuyOrder(
              manager,
              account,
              stock,
              order,
              executionPrice,
            )
          : await this.fillSellOrder(
              manager,
              account,
              stock,
              order,
              executionPrice,
            );
      } catch (error) {
        if (error instanceof BadRequestException) {
          return null;
        }

        throw error;
      }
    });
  }

  private async triggerStopLimitOrder(orderId: string, currentPrice: number) {
    return this.accountRepository.manager.transaction(async (manager) => {
      const order = await manager.findOne(InvestmentOrder, {
        where: {
          orderId,
          status: OrderStatus.PENDING,
          orderType: OrderType.STOP_LIMIT,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order || !this.canTriggerStopOrder(order, currentPrice)) {
        return null;
      }

      order.triggeredAt = order.triggeredAt ?? new Date();
      order.orderType = OrderType.LIMIT;
      await manager.save(InvestmentOrder, order);

      if (!this.canFillLimitOrder(order, currentPrice)) {
        return this.toOrderPlacementResponse(order, null, null, null);
      }

      const account = await this.ensureAccountForUpdate(manager, order.userId);
      const stock = await manager.findOne(Stock, {
        where: {
          stockId: order.stockId,
          status: StockStatus.ACTIVE,
          isActive: true,
        },
      });

      if (!stock) {
        order.status = OrderStatus.REJECTED;
        await manager.save(InvestmentOrder, order);
        return null;
      }

      return order.side === OrderSide.BUY
        ? this.fillBuyOrder(manager, account, stock, order, currentPrice)
        : this.fillSellOrder(manager, account, stock, order, currentPrice);
    });
  }

  private async fillBuyOrder(
    manager: EntityManager,
    account: TradingAccount,
    stock: Stock,
    order: InvestmentOrder,
    executionPrice: number,
  ) {
    const totalAmount = executionPrice * order.quantity;
    const availableCash = await this.getAvailableCash(
      manager,
      account,
      order.orderId,
    );

    if (availableCash < totalAmount) {
      order.status = OrderStatus.REJECTED;
      await manager.save(InvestmentOrder, order);
      throw new BadRequestException('주문 가능 현금이 부족합니다.');
    }

    let holding = await manager.findOne(Holding, {
      where: { accountId: account.accountId, stockId: stock.stockId },
      lock: { mode: 'pessimistic_write' },
    });

    if (holding) {
      const currentAmount = Number(holding.avgBuyPrice) * holding.quantity;
      const nextQuantity = holding.quantity + order.quantity;
      holding.quantity = nextQuantity;
      holding.avgBuyPrice = this.toDecimal(
        (currentAmount + totalAmount) / nextQuantity,
      );
    } else {
      holding = manager.create(Holding, {
        accountId: account.accountId,
        stockId: stock.stockId,
        quantity: order.quantity,
        avgBuyPrice: this.toDecimal(executionPrice),
      });
    }

    account.cashBalance = this.toDecimal(Number(account.cashBalance) - totalAmount);
    await manager.save(Holding, holding);
    account.totalAssetValue = await this.calculateTotalAssetValue(
      manager,
      account.accountId,
      account.cashBalance,
    );
    await manager.save(TradingAccount, account);

    const savedTrade = await this.saveTradeAndCashHistory(
      manager,
      account,
      stock,
      TradeType.BUY,
      order.quantity,
      executionPrice,
      totalAmount,
      -totalAmount,
    );

    return this.finalizeFilledOrder(
      manager,
      order,
      executionPrice,
      savedTrade,
      stock,
      account,
      {
        ticker: stock.ticker,
        companyName: stock.companyName,
        quantity: holding.quantity,
        averagePrice: holding.avgBuyPrice,
      },
    );
  }

  private async fillSellOrder(
    manager: EntityManager,
    account: TradingAccount,
    stock: Stock,
    order: InvestmentOrder,
    executionPrice: number,
  ) {
    const holding = await manager.findOne(Holding, {
      where: { accountId: account.accountId, stockId: stock.stockId },
      lock: { mode: 'pessimistic_write' },
    });
    const sellableQuantity = await this.getSellableQuantity(
      manager,
      account.accountId,
      stock.stockId,
      order.orderId,
    );

    if (!holding || sellableQuantity < order.quantity) {
      order.status = OrderStatus.REJECTED;
      await manager.save(InvestmentOrder, order);
      throw new BadRequestException('매도 가능 수량이 부족합니다.');
    }

    const totalAmount = executionPrice * order.quantity;
    const realizedProfit =
      (executionPrice - Number(holding.avgBuyPrice)) * order.quantity;

    holding.quantity -= order.quantity;
    account.cashBalance = this.toDecimal(Number(account.cashBalance) + totalAmount);

    if (holding.quantity === 0) {
      await manager.remove(Holding, holding);
    } else {
      await manager.save(Holding, holding);
    }

    account.totalAssetValue = await this.calculateTotalAssetValue(
      manager,
      account.accountId,
      account.cashBalance,
    );
    await manager.save(TradingAccount, account);

    const savedTrade = await this.saveTradeAndCashHistory(
      manager,
      account,
      stock,
      TradeType.SELL,
      order.quantity,
      executionPrice,
      totalAmount,
      totalAmount,
    );

    return this.finalizeFilledOrder(
      manager,
      order,
      executionPrice,
      savedTrade,
      stock,
      account,
      holding.quantity === 0
        ? null
        : {
            ticker: stock.ticker,
            companyName: stock.companyName,
            quantity: holding.quantity,
            averagePrice: holding.avgBuyPrice,
          },
      this.toDecimal(realizedProfit),
    );
  }

  private async finalizeFilledOrder(
    manager: EntityManager,
    order: InvestmentOrder,
    executionPrice: number,
    trade: Trade,
    stock: Stock,
    account: TradingAccount,
    holding: unknown,
    realizedProfit?: string,
  ) {
    order.status = OrderStatus.FILLED;
    order.executionPrice = this.toDecimal(executionPrice);
    order.filledAt = new Date();
    await manager.save(InvestmentOrder, order);

    return this.toOrderPlacementResponse(
      order,
      realizedProfit
        ? { ...this.toTradeResponse({ ...trade, stock }), realizedProfit }
        : this.toTradeResponse({ ...trade, stock }),
      {
        cashBalance: account.cashBalance,
        totalAssetValue: account.totalAssetValue,
      },
      holding,
    );
  }

  private async saveTradeAndCashHistory(
    manager: EntityManager,
    account: TradingAccount,
    stock: Stock,
    tradeType: TradeType,
    quantity: number,
    executionPrice: number,
    totalAmount: number,
    cashHistoryAmount: number,
  ) {
    const trade = manager.create(Trade, {
      accountId: account.accountId,
      stockId: stock.stockId,
      tradeType,
      quantity,
      unitPrice: this.toDecimal(executionPrice),
      totalAmount: this.toDecimal(totalAmount),
    });
    const savedTrade = await manager.save(Trade, trade);

    await this.saveCashHistory(
      manager,
      account,
      tradeType === TradeType.BUY ? CashHistoryType.BUY : CashHistoryType.SELL,
      cashHistoryAmount,
      'TRADE',
      savedTrade.tradeId,
    );

    return savedTrade;
  }

  private async getAvailableCash(
    manager: EntityManager,
    account: TradingAccount,
    excludeOrderId?: string,
  ) {
    const query = manager
      .createQueryBuilder(InvestmentOrder, 'order')
      .select('COALESCE(SUM(order.reserved_amount), 0)', 'sum')
      .where('order.account_id = :accountId', { accountId: account.accountId })
      .andWhere('order.status = :status', { status: OrderStatus.PENDING })
      .andWhere('order.side = :side', { side: OrderSide.BUY });

    if (excludeOrderId) {
      query.andWhere('order.order_id != :excludeOrderId', { excludeOrderId });
    }

    const row = await query.getRawOne<{ sum: string }>();
    return Number(account.cashBalance) - Number(row?.sum ?? 0);
  }

  private async getSellableQuantity(
    manager: EntityManager,
    accountId: number,
    stockId: number,
    excludeOrderId?: string,
  ) {
    const holding = await manager.findOne(Holding, {
      where: { accountId, stockId },
      lock: { mode: 'pessimistic_write' },
    });
    const holdingQuantity = holding?.quantity ?? 0;
    const query = manager
      .createQueryBuilder(InvestmentOrder, 'order')
      .select('COALESCE(SUM(order.quantity), 0)', 'sum')
      .where('order.account_id = :accountId', { accountId })
      .andWhere('order.stock_id = :stockId', { stockId })
      .andWhere('order.status = :status', { status: OrderStatus.PENDING })
      .andWhere('order.side = :side', { side: OrderSide.SELL });

    if (excludeOrderId) {
      query.andWhere('order.order_id != :excludeOrderId', { excludeOrderId });
    }

    const row = await query.getRawOne<{ sum: string }>();
    return holdingQuantity - Number(row?.sum ?? 0);
  }

  private resolveStockCode(dto: CreateTradeDto) {
    const stockCode = dto.stockCode ?? dto.ticker;
    if (!stockCode) {
      throw new BadRequestException('stockCode 또는 ticker가 필요합니다.');
    }

    return stockCode;
  }

  private async resolveServerCurrentPrice(stockCode: string) {
    // Unified simulation price: KRX/NXT are not priced separately in this app.
    // tradingVenue affects availability and session rules only.
    const currentPrice = await this.kiwoomWebSocketService.getCurrentPrice(stockCode);

    if (!this.isValidPrice(currentPrice)) {
      throw new NotFoundException(
        '현재 시세를 확인할 수 없어 주문을 처리할 수 없습니다.',
      );
    }

    return currentPrice as number;
  }

  private canFillLimitOrder(order: InvestmentOrder, currentPrice: number) {
    const limitPrice = Number(order.limitPrice);
    return this.canFillLimitValues(order.side, currentPrice, limitPrice);
  }

  private canTriggerStopOrder(order: InvestmentOrder, currentPrice: number) {
    const stopPrice = Number(order.stopPrice);
    return this.canTriggerStopValues(order.side, currentPrice, stopPrice);
  }

  private canTriggerStopValues(
    side: OrderSide,
    currentPrice: number,
    stopPrice: number,
  ) {
    if (!this.isValidPrice(stopPrice)) return false;

    return side === OrderSide.BUY
      ? currentPrice >= stopPrice
      : currentPrice <= stopPrice;
  }

  private canFillLimitValues(
    side: OrderSide,
    currentPrice: number,
    limitPrice: number,
  ) {
    return side === OrderSide.BUY
      ? currentPrice <= limitPrice
      : currentPrice >= limitPrice;
  }

  private isValidPrice(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  private async resolveTodayClosePrice(stock: Stock) {
    const today = this.formatDate(this.getKstNow());
    const storedPrice = await this.stockPriceDailyRepository.findOne({
      where: { stockId: stock.stockId, tradeDate: today },
    });

    const storedClosePrice = Number(storedPrice?.closePrice);
    if (this.isValidPrice(storedClosePrice)) {
      return storedClosePrice;
    }

    const fetchedPrice = await this.fetchTodayClosePriceFromKiwoom(stock, today);
    if (fetchedPrice) {
      return fetchedPrice;
    }

    throw new NotFoundException(
      'Today close price is unavailable, so AFTER_HOURS_CLOSE orders cannot be processed.',
    );
  }

  private async fetchTodayClosePriceFromKiwoom(stock: Stock, tradeDate: string) {
    const host =
      this.configService.get<string>('KIWOOM_API_HOST') ??
      'https://api.kiwoom.com';
    const token = await this.kiwoomAuthService.getAccessToken();
    const baseDt = tradeDate.replace(/-/g, '');

    let data: Record<string, any>;
    try {
      const response = await axios.post(
        `${host}/api/dostk/chart`,
        {
          stk_cd: stock.ticker,
          base_dt: baseDt,
          upd_stkpc_tp: '1',
        },
        {
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            authorization: `Bearer ${token}`,
            'api-id': 'ka10081',
            'cont-yn': 'N',
            'next-key': '',
          },
          timeout: 10_000,
        },
      );
      data = response.data;
    } catch (error) {
      this.logger.warn(
        `today close price lookup failed stockCode=${stock.ticker}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }

    if (Number(data?.return_code ?? 0) !== 0) {
      return null;
    }

    const rows = Array.isArray(data?.stk_dt_pole_chart_qry)
      ? data.stk_dt_pole_chart_qry
      : [];
    const todayRow = rows.find((row: Record<string, unknown>) => {
      const rowDate = String(row?.dt ?? row?.date ?? '').replace(/-/g, '');
      return rowDate === baseDt;
    });

    if (!todayRow) {
      return null;
    }

    const closePrice = this.toPositiveNumber(
      todayRow.cur_prc ?? todayRow.close_pric ?? todayRow.close,
    );
    if (!this.isValidPrice(closePrice)) {
      return null;
    }

    await this.stockPriceDailyRepository.upsert(
      this.stockPriceDailyRepository.create({
        stockId: stock.stockId,
        tradeDate,
        openPrice: this.toDecimalOrNull(
          todayRow.open_pric ?? todayRow.open,
        ),
        highPrice: this.toDecimalOrNull(
          todayRow.high_pric ?? todayRow.high,
        ),
        lowPrice: this.toDecimalOrNull(todayRow.low_pric ?? todayRow.low),
        closePrice: this.toDecimal(closePrice),
        volume: this.toIntegerStringOrNull(
          todayRow.trde_qty ?? todayRow.volume,
        ),
      }),
      ['stockId', 'tradeDate'],
    );

    return closePrice;
  }

  private async checkNxtAvailabilityByKiwoom(ticker: string) {
    const host =
      this.configService.get<string>('KIWOOM_API_HOST') ??
      'https://api.kiwoom.com';
    const path =
      this.configService.get<string>('KIWOOM_NXT_ELIGIBILITY_PATH') ??
      '/api/dostk/stkinfo';
    const apiId =
      this.configService.get<string>('KIWOOM_NXT_ELIGIBILITY_API_ID') ??
      'ka10001';
    const suffix =
      this.configService.get<string>('KIWOOM_NXT_ELIGIBILITY_CODE_SUFFIX') ??
      '_NX';
    const token = await this.kiwoomAuthService.getAccessToken();
    const nxtCode = `${ticker}${suffix}`;

    const response = await axios.post(
      `${host}${path}`,
      {
        stk_cd: nxtCode,
        stex_tp: '2',
      },
      {
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          authorization: `Bearer ${token}`,
          'api-id': apiId,
          'cont-yn': 'N',
          'next-key': '',
        },
        timeout: 10_000,
      },
    );

    const data = response.data;
    const returnCode = Number(data?.return_code ?? 0);
    if (returnCode !== 0) {
      return false;
    }

    const message = String(data?.return_msg ?? '');
    if (/조회.*없|없습니다|불가|not\s*found|invalid/i.test(message)) {
      return false;
    }

    return this.hasMeaningfulKiwoomNxtPayload(data, nxtCode);
  }

  private hasMeaningfulKiwoomNxtPayload(data: unknown, nxtCode: string) {
    if (!data || typeof data !== 'object') return false;

    const payload = data as Record<string, unknown>;
    const stockCode = String(payload.stk_cd ?? '').trim();
    const stockName = String(payload.stk_nm ?? '').trim();
    const currentPrice = String(payload.cur_prc ?? '').trim();

    if (stockCode !== nxtCode) return false;
    if (!stockName) return false;
    if (!currentPrice) return false;

    return true;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async assertRegularMarketSession(
    market: string | null | undefined,
    tradingVenue: TradingVenue,
  ) {
    if (!(await this.isRegularMarketOpen(market, tradingVenue))) {
      throw new BadRequestException(
        'This order type is available only during regular market hours.',
      );
    }
  }

  private async assertAfterHoursCloseSession(
    market: string | null | undefined,
    tradingVenue: TradingVenue,
  ) {
    if (!(await this.isAfterHoursCloseSession(market, tradingVenue))) {
      throw new BadRequestException(
        'AFTER_HOURS_CLOSE orders are available only during the after-hours close session.',
      );
    }
  }

  private assertReservationOrderEntrySession() {
    if (this.isReservationOrderEntrySession()) {
      return;
    }

    throw new BadRequestException(
      'RESERVATION orders can be placed only from 16:00 to 07:30 KST.',
    );
  }

  private isReservationOrderEntrySession() {
    const seconds = this.getKstSeconds();
    return (
      this.isBetweenSeconds(seconds, 16 * 3600, 24 * 3600) ||
      this.isBetweenSeconds(seconds, 0, 7 * 3600 + 30 * 60)
    );
  }

  private async isRegularMarketOpen(
    market?: string | null,
    tradingVenue: TradingVenue = TradingVenue.KRX,
  ) {
    if (!(await this.isTradingBusinessDay(market))) return false;

    const seconds = this.getKstSeconds();
    if (tradingVenue === TradingVenue.NXT) {
      return (
        this.isBetweenSeconds(seconds, 8 * 3600, 8 * 3600 + 50 * 60) ||
        this.isBetweenSeconds(
          seconds,
          9 * 3600 + 30,
          15 * 3600 + 20 * 60,
        ) ||
        this.isBetweenSeconds(seconds, 15 * 3600 + 40 * 60, 20 * 3600)
      );
    }

    return this.isBetweenSeconds(seconds, 9 * 3600, 15 * 3600 + 30 * 60);
  }

  private async isNxtAfterMarketOrderAcceptanceOnly(
    market?: string | null,
    tradingVenue: TradingVenue = TradingVenue.KRX,
  ) {
    if (tradingVenue !== TradingVenue.NXT) return false;
    if (!(await this.isTradingBusinessDay(market))) return false;

    const seconds = this.getKstSeconds();
    return this.isBetweenSeconds(seconds, 15 * 3600 + 30 * 60, 15 * 3600 + 40 * 60);
  }

  private async isConditionalLimitCloseSession(market?: string | null) {
    if (!(await this.isTradingBusinessDay(market))) return false;

    const seconds = this.getKstSeconds();
    return this.isBetweenSeconds(seconds, 15 * 3600 + 20 * 60, 15 * 3600 + 30 * 60);
  }

  private async isAfterHoursCloseSession(
    market?: string | null,
    tradingVenue: TradingVenue = TradingVenue.KRX,
  ) {
    if (!(await this.isTradingBusinessDay(market))) return false;

    const seconds = this.getKstSeconds();
    if (tradingVenue === TradingVenue.NXT) {
      return this.isBetweenSeconds(seconds, 15 * 3600 + 30 * 60, 16 * 3600);
    }

    return this.isBetweenSeconds(seconds, 15 * 3600 + 40 * 60, 16 * 3600);
  }

  private async isTradingBusinessDay(market?: string | null) {
    const now = this.getKstNow();
    const day = now.getDay();
    if (day === 0 || day === 6) return false;

    const holiday = await this.marketHolidayRepository.findOne({
      where: {
        holidayDate: this.formatDate(now),
        market: this.resolveMarketCode(market),
      },
    });

    return !holiday;
  }

  private getKstSeconds() {
    const now = this.getKstNow();
    return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  }

  private isBetweenSeconds(value: number, start: number, end: number) {
    return value >= start && value < end;
  }

  private getKstNow() {
    return new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
    );
  }

  private resolveMarketCode(market?: string | null) {
    const normalized = (market?.trim() || 'KRX').toUpperCase();
    if (['KOSPI', 'KOSDAQ', 'KONEX'].includes(normalized)) {
      return 'KRX';
    }

    return normalized;
  }

  private resolveTradingVenue(tradingVenue?: TradingVenue | null) {
    return tradingVenue ?? TradingVenue.KRX;
  }

  private async assertTradingVenueAvailable(
    stock: Stock,
    tradingVenue: TradingVenue,
  ) {
    if (await this.isTradingVenueAvailable(stock, tradingVenue)) {
      return;
    }

    throw new BadRequestException(
      `This stock is not available on ${tradingVenue}.`,
    );
  }

  private async isTradingVenueAvailable(
    stock: Stock,
    tradingVenue: TradingVenue,
  ) {
    if (tradingVenue === TradingVenue.KRX) {
      return this.resolveMarketCode(stock.market) === 'KRX';
    }

    const venue = await this.stockTradingVenueRepository.findOne({
      where: {
        stockId: stock.stockId,
        tradingVenue,
        isActive: true,
      },
    });

    return !!venue;
  }

  private formatDate(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async ensureAccount(userId: number) {
    const existing = await this.accountRepository.findOne({
      where: { userId },
      order: { accountId: 'DESC' },
    });

    if (existing) return existing;

    return this.accountRepository.save(
      this.accountRepository.create({
        userId,
        seedMoney: this.toDecimal(INITIAL_CASH_BALANCE),
        cashBalance: this.toDecimal(INITIAL_CASH_BALANCE),
        totalAssetValue: this.toDecimal(INITIAL_CASH_BALANCE),
      }),
    );
  }

  private async ensureAccountForUpdate(manager: EntityManager, userId: number) {
    let account = await manager.findOne(TradingAccount, {
      where: { userId },
      order: { accountId: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });

    if (!account) {
      account = await manager.save(
        TradingAccount,
        manager.create(TradingAccount, {
          userId,
          seedMoney: this.toDecimal(INITIAL_CASH_BALANCE),
          cashBalance: this.toDecimal(INITIAL_CASH_BALANCE),
          totalAssetValue: this.toDecimal(INITIAL_CASH_BALANCE),
        }),
      );
    }

    return account;
  }

  private async findActiveStock(ticker: string) {
    const stock = await this.stockRepository.findOne({
      where: { ticker, status: StockStatus.ACTIVE, isActive: true },
    });

    if (!stock) {
      throw new NotFoundException('거래 가능한 종목을 찾을 수 없습니다.');
    }

    return stock;
  }

  private async calculateTotalAssetValue(
    manager: EntityManager,
    accountId: number,
    cashBalance: string,
  ) {
    const holdings = await manager.find(Holding, {
      where: { accountId },
      relations: { stock: true },
    });

    let stockValue = 0;
    for (const holding of holdings) {
      const valuationPrice = await this.resolveValuationPrice(manager, holding);
      stockValue += holding.quantity * valuationPrice;
    }

    return this.toDecimal(Number(cashBalance) + stockValue);
  }

  private async resolveValuationPrice(
    manager: EntityManager,
    holding: Holding,
  ) {
    const fallbackPrice = Number(holding.avgBuyPrice);
    const ticker = holding.stock?.ticker;

    if (ticker) {
      const currentPrice = await this.kiwoomWebSocketService.getCurrentPrice(
        ticker,
      );
      if (this.isValidPrice(currentPrice)) {
        return currentPrice;
      }
    }

    const latestPrice = await manager.findOne(StockPriceDaily, {
      where: { stockId: holding.stockId },
      order: { tradeDate: 'DESC' },
    });
    const closePrice = Number(latestPrice?.closePrice);
    if (this.isValidPrice(closePrice)) {
      return closePrice;
    }

    return this.isValidPrice(fallbackPrice) ? fallbackPrice : 0;
  }

  private async saveCashHistory(
    manager: EntityManager,
    account: TradingAccount,
    historyType: CashHistoryType,
    amount: number,
    refType: string,
    refId: string,
  ) {
    await manager.save(
      AccountCashHistory,
      manager.create(AccountCashHistory, {
        accountId: account.accountId,
        historyType,
        amount: this.toDecimal(amount),
        balanceAfter: account.cashBalance,
        refType,
        refId,
      }),
    );
  }

  private toTradeResponse(trade: Trade) {
    return {
      tradeId: trade.tradeId,
      accountId: trade.accountId,
      tradeType: trade.tradeType,
      ticker: trade.stock?.ticker,
      companyName: trade.stock?.companyName,
      quantity: trade.quantity,
      price: trade.unitPrice,
      totalAmount: trade.totalAmount,
      createdAt: trade.tradedAt,
    };
  }

  private toOrderPlacementResponse(
    order: InvestmentOrder,
    trade: unknown,
    account: unknown,
    holding: unknown,
  ) {
    return {
      order: this.toOrderResponse(order),
      trade,
      account,
      holding,
    };
  }

  private toOrderResponse(order: InvestmentOrder) {
    return {
      orderId: order.orderId,
      userId: order.userId,
      accountId: order.accountId,
      stockId: order.stockId,
      stockCode: order.stockCode,
      tradingVenue: order.tradingVenue,
      side: order.side,
      orderType: order.orderType,
      status: order.status,
      quantity: order.quantity,
      limitPrice: order.limitPrice,
      stopPrice: order.stopPrice,
      executionOrderType: order.executionOrderType,
      reservedAmount: order.reservedAmount,
      executionPrice: order.executionPrice,
      scheduledAt: order.scheduledAt,
      triggeredAt: order.triggeredAt,
      createdAt: order.createdAt,
      filledAt: order.filledAt,
      cancelledAt: order.cancelledAt,
    };
  }

  private toDecimal(value: number) {
    return value.toFixed(2);
  }

  private toDecimalOrNull(value: unknown) {
    const numberValue = this.toPositiveNumber(value);
    return this.isValidPrice(numberValue) ? this.toDecimal(numberValue) : null;
  }

  private toIntegerStringOrNull(value: unknown) {
    const numberValue = this.toPositiveNumber(value);
    if (numberValue === null || !Number.isFinite(numberValue)) {
      return null;
    }

    return Math.trunc(numberValue).toString();
  }

  private toPositiveNumber(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    const numberValue = Number(String(value).replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(numberValue)) {
      return null;
    }

    return Math.abs(numberValue);
  }
}
