import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { KiwoomWebSocketService } from '../../kiwoom/services/kiwoom-websocket.service';
import { Stock, StockStatus } from '../../stocks/entities/stock.entity';
import { CreateTradeDto } from '../dto/create-trade.dto';
import { RankingQueryDto } from '../dto/ranking-query.dto';
import { TradeHistoryQueryDto } from '../dto/trade-history-query.dto';
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
} from '../entities/investment-order.entity';
import { Trade, TradeType } from '../entities/trade.entity';
import { TradingAccount } from '../entities/trading-account.entity';

const INITIAL_CASH_BALANCE = 10000000;

@Injectable()
export class TradingService implements OnModuleInit {
  private readonly logger = new Logger(TradingService.name);

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

    private readonly kiwoomWebSocketService: KiwoomWebSocketService,
  ) {}

  onModuleInit() {
    this.kiwoomWebSocketService.registerPriceListener((stockCode, price) => {
      void this.processPrice(stockCode, price);
    });
  }

  async findAccount(userId: number) {
    const account = await this.ensureAccount(userId);

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

    return holdings.map((holding) => ({
      holdingId: holding.holdingId,
      accountId: holding.accountId,
      stockId: holding.stockId,
      ticker: holding.stock.ticker,
      companyName: holding.stock.companyName,
      quantity: holding.quantity,
      averagePrice: holding.avgBuyPrice,
      updatedAt: holding.updatedAt,
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
    return this.placeOrder(userId, dto, OrderSide.BUY);
  }

  async sell(userId: number, dto: CreateTradeDto) {
    return this.placeOrder(userId, dto, OrderSide.SELL);
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
        orderType: OrderType.LIMIT,
      },
      order: { createdAt: 'ASC' },
      take: 50,
    });

    for (const order of pendingOrders) {
      if (this.canFillLimitOrder(order, currentPrice)) {
        await this.fillPendingOrder(order.orderId, currentPrice);
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

  private async placeOrder(
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
    const holdings = await manager.find(Holding, { where: { accountId } });
    const stockValue = holdings.reduce(
      (sum, holding) => sum + holding.quantity * Number(holding.avgBuyPrice),
      0,
    );

    return this.toDecimal(Number(cashBalance) + stockValue);
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
      side: order.side,
      orderType: order.orderType,
      status: order.status,
      quantity: order.quantity,
      limitPrice: order.limitPrice,
      reservedAmount: order.reservedAmount,
      executionPrice: order.executionPrice,
      createdAt: order.createdAt,
      filledAt: order.filledAt,
      cancelledAt: order.cancelledAt,
    };
  }

  private toDecimal(value: number) {
    return value.toFixed(2);
  }
}
