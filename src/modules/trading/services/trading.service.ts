import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { StockPriceDaily } from '../../stocks/entities/stock-price-daily.entity';
import { Stock, StockStatus } from '../../stocks/entities/stock.entity';
import { CreateTradeDto } from '../dto/create-trade.dto';
import { TradeHistoryQueryDto } from '../dto/trade-history-query.dto';
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

  async buy(userId: number, dto: CreateTradeDto) {
    return this.accountRepository.manager.transaction(async (manager) => {
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
        'TRADE',
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
  }

  async sell(userId: number, dto: CreateTradeDto) {
    return this.accountRepository.manager.transaction(async (manager) => {
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
        'TRADE',
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

  private toDecimal(value: number) {
    return value.toFixed(2);
  }
}
