import { NotFoundException } from '@nestjs/common';
import { Stock, StockStatus } from '../../stocks/entities/stock.entity';
import {
  InvestmentOrder,
  OrderSide,
  OrderStatus,
  OrderType,
  TradingVenue,
} from '../entities/investment-order.entity';
import { TradingService } from './trading.service';

const makeService = (overrides: Record<string, any> = {}) => {
  const manager = {
    transaction: jest.fn((callback) => callback(manager)),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const accountRepository = {
    manager,
  };
  const orderRepository = {
    find: jest.fn(),
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
    {} as any,
    (overrides.kiwoomWebSocketService ?? kiwoomWebSocketService) as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  return {
    service,
    manager,
    orderRepository,
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
});
