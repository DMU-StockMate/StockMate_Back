import { NotFoundException } from '@nestjs/common';
import { Stock, StockStatus } from '../../stocks/entities/stock.entity';
import { StockPriceDaily } from '../../stocks/entities/stock-price-daily.entity';
import {
  AccountCashHistory,
  CashHistoryType,
} from '../entities/account-cash-history.entity';
import {
  InvestmentOrder,
  OrderSide,
  OrderStatus,
  OrderType,
  TradingVenue,
} from '../entities/investment-order.entity';
import { TradingAccount } from '../entities/trading-account.entity';
import { TradingService } from './trading.service';

const makeService = (overrides: Record<string, any> = {}) => {
  const manager = {
    transaction: jest.fn((callback) => callback(manager)),
    findOne: jest.fn(),
    create: jest.fn((_entity, value) => value),
    save: jest.fn(),
  };
  const accountRepository = {
    manager,
  };
  const orderRepository = {
    find: jest.fn(),
  };
  const stockPriceDailyRepository = {
    findOne: jest.fn(),
  };
  const marketHolidayRepository = {
    findOne: jest.fn().mockResolvedValue(null),
  };
  const kiwoomWebSocketService = {
    getCurrentPrice: jest.fn(),
    getCurrentPriceWithRestFallback: jest.fn(),
    registerPriceListener: jest.fn(),
  };

  const service = new TradingService(
    (overrides.accountRepository ?? accountRepository) as any,
    {} as any,
    (overrides.orderRepository ?? orderRepository) as any,
    {} as any,
    {} as any,
    {} as any,
    (overrides.stockPriceDailyRepository ?? stockPriceDailyRepository) as any,
    (overrides.kiwoomWebSocketService ?? kiwoomWebSocketService) as any,
    {} as any,
    (overrides.marketHolidayRepository ?? marketHolidayRepository) as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  return {
    service,
    manager,
    orderRepository,
    stockPriceDailyRepository,
    marketHolidayRepository,
    kiwoomWebSocketService,
  };
};

describe('TradingService order execution safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses server current price fallback and never requires a request price', async () => {
    const { service, kiwoomWebSocketService } = makeService();
    kiwoomWebSocketService.getCurrentPriceWithRestFallback.mockResolvedValue(
      70000,
    );

    await expect(
      (service as any).resolveServerCurrentPrice('005930'),
    ).resolves.toBe(70000);

    expect(
      kiwoomWebSocketService.getCurrentPriceWithRestFallback,
    ).toHaveBeenCalledWith('005930');
  });

  it('rejects MARKET execution when cache and REST fallback cannot provide a price', async () => {
    const { service, kiwoomWebSocketService } = makeService();
    kiwoomWebSocketService.getCurrentPriceWithRestFallback.mockResolvedValue(
      null,
    );

    await expect(
      (service as any).resolveServerCurrentPrice('005930'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not execute the same pending order twice through the common path', async () => {
    const { service, manager } = makeService();
    const order = {
      orderId: '1',
      userId: 7,
      accountId: 3,
      stockId: 5,
      stockCode: '005930',
      tradingVenue: TradingVenue.KRX,
      side: OrderSide.BUY,
      orderType: OrderType.LIMIT,
      status: OrderStatus.PENDING,
      quantity: 10,
      limitPrice: '71000.00',
    } as InvestmentOrder;
    const stock = {
      stockId: 5,
      ticker: '005930',
      status: StockStatus.ACTIVE,
      isActive: true,
    } as Stock;
    const account = { accountId: 3, userId: 7, cashBalance: '1000000.00' };

    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === InvestmentOrder) {
        return order.status === OrderStatus.PENDING ? order : null;
      }
      if (entity === Stock) {
        return stock;
      }
      return null;
    });

    (service as any).ensureAccountForUpdate = jest
      .fn()
      .mockResolvedValue(account);
    (service as any).fillBuyOrder = jest.fn(async () => {
      order.status = OrderStatus.FILLED;
      return {
        order: {
          status: OrderStatus.FILLED,
          executionPrice: '70000.00',
        },
      };
    });

    await expect(
      (service as any).executePendingOrder('1', 70000, {
        requireLimitCondition: true,
      }),
    ).resolves.toEqual({
      order: {
        status: OrderStatus.FILLED,
        executionPrice: '70000.00',
      },
    });
    await expect(
      (service as any).executePendingOrder('1', 70000, {
        requireLimitCondition: true,
      }),
    ).resolves.toBeNull();

    expect((service as any).fillBuyOrder).toHaveBeenCalledTimes(1);
  });

  it('does not cancel another user order because cancel lookup includes userId', async () => {
    const { service, manager } = makeService();
    manager.findOne.mockResolvedValue(null);

    await expect(service.cancelOrder(7, '10')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.findOne).toHaveBeenCalledWith(
      InvestmentOrder,
      expect.objectContaining({
        where: { orderId: '10', userId: 7 },
      }),
    );
  });

  it('reconciles only cached pending prices and reuses pending order processing', async () => {
    const { service, orderRepository, kiwoomWebSocketService } = makeService();
    const stock = {
      stockId: 5,
      ticker: '005930',
      status: StockStatus.ACTIVE,
      isActive: true,
    } as Stock;
    const order = {
      orderId: '1',
      stock,
      stockId: 5,
      stockCode: '005930',
      status: OrderStatus.PENDING,
      orderType: OrderType.LIMIT,
    } as InvestmentOrder;
    orderRepository.find.mockResolvedValue([order]);
    kiwoomWebSocketService.getCurrentPrice.mockResolvedValue(70000);
    (service as any).processPendingOrderWithPrice = jest
      .fn()
      .mockResolvedValue(undefined);

    await (service as any).reconcilePendingOrders();

    expect(orderRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: OrderStatus.PENDING,
        }),
        take: 100,
      }),
    );
    expect(kiwoomWebSocketService.getCurrentPrice).toHaveBeenCalledWith(
      '005930',
    );
    expect((service as any).processPendingOrderWithPrice).toHaveBeenCalledWith(
      order,
      stock,
      70000,
    );
    expect(
      kiwoomWebSocketService.getCurrentPriceWithRestFallback,
    ).not.toHaveBeenCalled();
  });

  it('credits the same quiz reward reference only once', async () => {
    const { service, manager } = makeService();
    const account = {
      accountId: 3,
      userId: 7,
      cashBalance: '1000000.00',
      totalAssetValue: '1000000.00',
    };
    let rewardSaved = false;

    (service as any).ensureAccountForUpdate = jest
      .fn()
      .mockResolvedValue(account);
    (service as any).calculateTotalAssetValue = jest
      .fn()
      .mockResolvedValue('1001000.00');
    manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === AccountCashHistory && rewardSaved) {
        return {
          accountId: 3,
          historyType: CashHistoryType.REWARD,
          refType: 'QUIZ_QUESTION',
          refId: '1058',
        };
      }
      return null;
    });
    manager.save.mockImplementation(async (entity: unknown, value: any) => {
      if (entity === AccountCashHistory) {
        rewardSaved = true;
      }
      if (entity === TradingAccount) {
        return value;
      }
      return value;
    });

    await expect(
      service.creditReward(7, 1000, 1058, 'QUIZ_QUESTION'),
    ).resolves.toEqual(
      expect.objectContaining({
        credited: true,
        amount: 1000,
      }),
    );
    await expect(
      service.creditReward(7, 1000, 1058, 'QUIZ_QUESTION'),
    ).resolves.toEqual(
      expect.objectContaining({
        credited: false,
        amount: 0,
      }),
    );
  });

  it('enforces KRX regular market boundary times and holidays', async () => {
    const { service, marketHolidayRepository } = makeService();
    marketHolidayRepository.findOne.mockResolvedValue(null);
    let now = new Date('2026-09-21T08:59:59+09:00');
    (service as any).getKstNow = jest.fn(() => now);

    await expect(
      (service as any).isRegularMarketOpen('KOSPI', TradingVenue.KRX),
    ).resolves.toBe(false);

    now = new Date('2026-09-21T09:00:00+09:00');
    await expect(
      (service as any).isRegularMarketOpen('KOSPI', TradingVenue.KRX),
    ).resolves.toBe(true);

    now = new Date('2026-09-21T15:30:00+09:00');
    await expect(
      (service as any).isRegularMarketOpen('KOSPI', TradingVenue.KRX),
    ).resolves.toBe(false);

    now = new Date('2026-09-26T10:00:00+09:00');
    await expect(
      (service as any).isRegularMarketOpen('KOSPI', TradingVenue.KRX),
    ).resolves.toBe(false);

    now = new Date('2026-10-05T10:00:00+09:00');
    marketHolidayRepository.findOne.mockResolvedValueOnce({ holidayDate: '2026-10-05' });
    await expect(
      (service as any).isRegularMarketOpen('KOSPI', TradingVenue.KRX),
    ).resolves.toBe(false);
  });

  it('uses only today close for after-hours close orders', async () => {
    const { service, stockPriceDailyRepository } = makeService();
    const stock = { stockId: 5, ticker: '005930' } as Stock;
    (service as any).getKstNow = jest
      .fn()
      .mockReturnValue(new Date('2026-09-21T15:50:00+09:00'));
    stockPriceDailyRepository.findOne.mockResolvedValue({
      stockId: 5,
      tradeDate: '2026-09-21',
      closePrice: '70000.00',
    } as StockPriceDaily);

    await expect((service as any).resolveTodayClosePrice(stock)).resolves.toBe(
      70000,
    );
    expect(stockPriceDailyRepository.findOne).toHaveBeenCalledWith({
      where: { stockId: 5, tradeDate: '2026-09-21' },
    });
  });

  it('rejects after-hours close when today close is unavailable', async () => {
    const { service, stockPriceDailyRepository } = makeService();
    const stock = { stockId: 5, ticker: '005930' } as Stock;
    (service as any).getKstNow = jest
      .fn()
      .mockReturnValue(new Date('2026-09-21T15:50:00+09:00'));
    stockPriceDailyRepository.findOne.mockResolvedValue(null);
    (service as any).fetchTodayClosePriceFromKiwoom = jest
      .fn()
      .mockResolvedValue(null);

    await expect(
      (service as any).resolveTodayClosePrice(stock),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
