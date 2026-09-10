import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { StockPriceDaily } from '../../stocks/entities/stock-price-daily.entity';
import { Stock, StockStatus } from '../../stocks/entities/stock.entity';
<<<<<<< HEAD
import { NotificationType } from '../../notification/entities/notification.entity';
import { NotificationService } from '../../notification/services/notification.service';
import { CreateTradeDto } from '../dto/create-trade.dto';
import { RankingQueryDto } from '../dto/ranking-query.dto';
import { TradeHistoryQueryDto } from '../dto/trade-history-query.dto';
import { AccountAssetSnapshot } from '../entities/account-asset-snapshot.entity';
=======
import { CreateTradeDto } from '../dto/create-trade.dto';
import { TradeHistoryQueryDto } from '../dto/trade-history-query.dto';
>>>>>>> 4babd34 (feat: implement core stock, learning, and trading APIs)
import {
  AccountCashHistory,
  CashHistoryType,
} from '../entities/account-cash-history.entity';
import { Holding } from '../entities/holding.entity';
import { Trade, TradeType } from '../entities/trade.entity';
import { TradingAccount } from '../entities/trading-account.entity';

const INITIAL_CASH_BALANCE = 10000000;

@Injectable()
export class TradingService {
  constructor(
    @InjectRepository(TradingAccount)
    private readonly accountRepository: Repository<TradingAccount>,

    @InjectRepository(Holding)
    private readonly holdingRepository: Repository<Holding>,

    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,

    @InjectRepository(AccountCashHistory)
    private readonly cashHistoryRepository: Repository<AccountCashHistory>,

    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,

    @InjectRepository(StockPriceDaily)
    private readonly stockPriceDailyRepository: Repository<StockPriceDaily>,
<<<<<<< HEAD

    @InjectRepository(AccountAssetSnapshot)
    private readonly assetSnapshotRepository: Repository<AccountAssetSnapshot>,

    private readonly notificationService: NotificationService,
=======
>>>>>>> 4babd34 (feat: implement core stock, learning, and trading APIs)
  ) {}

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
      where: {
        accountId: account.accountId,
      },
      relations: {
        stock: true,
      },
      order: {
        updatedAt: 'DESC',
      },
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

<<<<<<< HEAD
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

=======
>>>>>>> 4babd34 (feat: implement core stock, learning, and trading APIs)
  async findTrades(userId: number, query: TradeHistoryQueryDto) {
    const account = await this.ensureAccount(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.tradeRepository.findAndCount({
      where: {
        accountId: account.accountId,
      },
      relations: {
        stock: true,
      },
      order: {
        tradedAt: 'DESC',
      },
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

<<<<<<< HEAD
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
      .addSelect('account.total_asset_value - account.seed_money', 'growthAmount')
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
    const result = await this.accountRepository.manager.transaction(async (manager) => {
=======
  async buy(userId: number, dto: CreateTradeDto) {
    return this.accountRepository.manager.transaction(async (manager) => {
>>>>>>> 4babd34 (feat: implement core stock, learning, and trading APIs)
      const stock = await this.findActiveStock(dto.ticker);
      const price = await this.resolveTradePrice(stock.stockId, dto.price);
      const totalAmount = price * dto.quantity;
      const account = await this.ensureAccountForUpdate(manager, userId);

      if (Number(account.cashBalance) < totalAmount) {
        throw new BadRequestException('현금 잔고가 부족합니다.');
      }

      let holding = await manager.findOne(Holding, {
        where: {
          accountId: account.accountId,
          stockId: stock.stockId,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (holding) {
        const currentAmount = Number(holding.avgBuyPrice) * holding.quantity;
        const nextQuantity = holding.quantity + dto.quantity;
        holding.quantity = nextQuantity;
        holding.avgBuyPrice = this.toDecimal(
          (currentAmount + totalAmount) / nextQuantity,
        );
      } else {
        holding = manager.create(Holding, {
          accountId: account.accountId,
          stockId: stock.stockId,
          quantity: dto.quantity,
          avgBuyPrice: this.toDecimal(price),
        });
      }

      account.cashBalance = this.toDecimal(
        Number(account.cashBalance) - totalAmount,
      );

      const trade = manager.create(Trade, {
        accountId: account.accountId,
        stockId: stock.stockId,
        tradeType: TradeType.BUY,
        quantity: dto.quantity,
        unitPrice: this.toDecimal(price),
        totalAmount: this.toDecimal(totalAmount),
      });

      await manager.save(Holding, holding);
      account.totalAssetValue = await this.calculateTotalAssetValue(
        manager,
        account.accountId,
        account.cashBalance,
      );
      await manager.save(TradingAccount, account);
      const savedTrade = await manager.save(Trade, trade);
      await this.saveCashHistory(
        manager,
        account,
        CashHistoryType.BUY,
        -totalAmount,
<<<<<<< HEAD
        'TRADE',
=======
>>>>>>> 4babd34 (feat: implement core stock, learning, and trading APIs)
        savedTrade.tradeId,
      );

      return {
        trade: this.toTradeResponse({ ...savedTrade, stock }),
        account: {
          cashBalance: account.cashBalance,
          totalAssetValue: account.totalAssetValue,
        },
        holding: {
          ticker: stock.ticker,
          companyName: stock.companyName,
          quantity: holding.quantity,
          averagePrice: holding.avgBuyPrice,
        },
      };
    });
<<<<<<< HEAD

    await this.notificationService.create(
      userId,
      NotificationType.TRADE_EXECUTED,
      '매수 체결 완료',
      `${result.trade.companyName} ${dto.quantity}주 매수가 체결되었습니다.`,
      `/trade/stocks/${result.trade.ticker}`,
    );

    return result;
  }

  async sell(userId: number, dto: CreateTradeDto) {
    const result = await this.accountRepository.manager.transaction(async (manager) => {
=======
  }

  async sell(userId: number, dto: CreateTradeDto) {
    return this.accountRepository.manager.transaction(async (manager) => {
>>>>>>> 4babd34 (feat: implement core stock, learning, and trading APIs)
      const stock = await this.findActiveStock(dto.ticker);
      const price = await this.resolveTradePrice(stock.stockId, dto.price);
      const totalAmount = price * dto.quantity;
      const account = await this.ensureAccountForUpdate(manager, userId);

      const holding = await manager.findOne(Holding, {
        where: {
          accountId: account.accountId,
          stockId: stock.stockId,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!holding || holding.quantity < dto.quantity) {
        throw new BadRequestException('보유 수량이 부족합니다.');
      }

      const realizedProfit =
        (price - Number(holding.avgBuyPrice)) * dto.quantity;

      holding.quantity -= dto.quantity;
      account.cashBalance = this.toDecimal(
        Number(account.cashBalance) + totalAmount,
      );

      const trade = manager.create(Trade, {
        accountId: account.accountId,
        stockId: stock.stockId,
        tradeType: TradeType.SELL,
        quantity: dto.quantity,
        unitPrice: this.toDecimal(price),
        totalAmount: this.toDecimal(totalAmount),
      });

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
      const savedTrade = await manager.save(Trade, trade);
      await this.saveCashHistory(
        manager,
        account,
        CashHistoryType.SELL,
        totalAmount,
<<<<<<< HEAD
        'TRADE',
=======
>>>>>>> 4babd34 (feat: implement core stock, learning, and trading APIs)
        savedTrade.tradeId,
      );

      return {
        trade: {
          ...this.toTradeResponse({ ...savedTrade, stock }),
          realizedProfit: this.toDecimal(realizedProfit),
        },
        account: {
          cashBalance: account.cashBalance,
          totalAssetValue: account.totalAssetValue,
        },
        holding:
          holding.quantity === 0
            ? null
            : {
                ticker: stock.ticker,
                companyName: stock.companyName,
                quantity: holding.quantity,
                averagePrice: holding.avgBuyPrice,
              },
      };
    });
<<<<<<< HEAD

    await this.notificationService.create(
      userId,
      NotificationType.TRADE_EXECUTED,
      '매도 체결 완료',
      `${result.trade.companyName} ${dto.quantity}주 매도가 체결되었습니다.`,
      `/trade/stocks/${result.trade.ticker}`,
    );

    return result;
  }

  async creditReward(userId: number, amount: number, refId: number | string) {
    if (amount <= 0) return;

    return this.accountRepository.manager.transaction(async (manager) => {
      const account = await this.ensureAccountForUpdate(manager, userId);

      account.cashBalance = this.toDecimal(
        Number(account.cashBalance) + amount,
      );
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
=======
>>>>>>> 4babd34 (feat: implement core stock, learning, and trading APIs)
  }

  private async ensureAccount(userId: number) {
    const existing = await this.accountRepository.findOne({
      where: {
        userId,
      },
      order: {
        accountId: 'DESC',
      },
    });

    if (existing) {
      return existing;
    }

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
      where: {
        userId,
      },
      order: {
        accountId: 'DESC',
      },
      lock: {
        mode: 'pessimistic_write',
      },
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
      where: {
        ticker,
        status: StockStatus.ACTIVE,
        isActive: true,
      },
    });

    if (!stock) {
      throw new NotFoundException('거래 가능한 종목을 찾을 수 없습니다.');
    }

    return stock;
  }

  private async resolveTradePrice(stockId: number, requestedPrice?: number) {
    if (requestedPrice !== undefined) {
      return requestedPrice;
    }

    const latestPrice = await this.stockPriceDailyRepository.findOne({
      where: {
        stockId,
      },
      order: {
        tradeDate: 'DESC',
      },
    });

    if (!latestPrice?.closePrice) {
      throw new NotFoundException(
        '체결에 사용할 최신 종가를 찾을 수 없습니다.',
      );
    }

    return Number(latestPrice.closePrice);
  }

  private async calculateTotalAssetValue(
    manager: EntityManager,
    accountId: number,
    cashBalance: string,
  ) {
    const holdings = await manager.find(Holding, {
      where: {
        accountId,
      },
    });
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
<<<<<<< HEAD
    refType: string,
    refId: string,
=======
    tradeId: string,
>>>>>>> 4babd34 (feat: implement core stock, learning, and trading APIs)
  ) {
    await manager.save(
      AccountCashHistory,
      manager.create(AccountCashHistory, {
        accountId: account.accountId,
        historyType,
        amount: this.toDecimal(amount),
        balanceAfter: account.cashBalance,
<<<<<<< HEAD
        refType,
        refId,
=======
        refType: 'TRADE',
        refId: tradeId,
>>>>>>> 4babd34 (feat: implement core stock, learning, and trading APIs)
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

  private toDecimal(value: number) {
    return value.toFixed(2);
  }
}
