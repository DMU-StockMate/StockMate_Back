import { WatchlistService } from './watchlist.service';

const makeService = () => {
  const watchlistRepository = {
    findOne: jest.fn(),
    remove: jest.fn(),
  };
  const stockRepository = {};
  const kiwoomWebSocketService = {
    getCurrentPrice: jest.fn(),
    isSubscribedStock: jest.fn(),
    subscribeStocks: jest.fn(),
    unsubscribeStocks: jest.fn(),
  };
  const stockPriceSnapshotService = {
    findTwoLatestPricesByStock: jest.fn(),
    toNumberOrNull: jest.fn((value) => (value == null ? null : Number(value))),
    calculatePriceChange: jest.fn(),
  };

  return {
    service: new WatchlistService(
      watchlistRepository as any,
      stockRepository as any,
      kiwoomWebSocketService as any,
      stockPriceSnapshotService as any,
    ),
    watchlistRepository,
    kiwoomWebSocketService,
    stockPriceSnapshotService,
  };
};

describe('WatchlistService realtime price', () => {
  it('returns an empty realtime price instead of 404 while subscription has no tick yet', async () => {
    const {
      service,
      watchlistRepository,
      kiwoomWebSocketService,
      stockPriceSnapshotService,
    } = makeService();

    watchlistRepository.findOne.mockResolvedValue({
      watchlistId: '10',
      userId: 1,
      stockId: 2,
      stock: { ticker: '005930' },
    });
    kiwoomWebSocketService.getCurrentPrice.mockResolvedValue(null);
    stockPriceSnapshotService.findTwoLatestPricesByStock.mockResolvedValue([
      { closePrice: '70000' },
    ]);

    await expect(service.getRealtimePrice(1, '10')).resolves.toEqual({
      watchlistId: '10',
      stockCode: '005930',
      ticker: '005930',
      price: null,
      currentPrice: null,
      previousClosePrice: 70000,
      changePrice: null,
      changeRate: null,
    });
    expect(stockPriceSnapshotService.calculatePriceChange).not.toHaveBeenCalled();
  });

  it('subscribes realtime prices with a watchlist-scoped consumer id', async () => {
    const { service, watchlistRepository, kiwoomWebSocketService } =
      makeService();

    watchlistRepository.findOne.mockResolvedValue({
      watchlistId: '10',
      userId: 1,
      stockId: 2,
      stock: { ticker: '005930' },
    });

    await service.subscribeRealtime(1, '10');

    expect(kiwoomWebSocketService.subscribeStocks).toHaveBeenCalledWith(
      ['005930'],
      'watchlist:1:10',
    );
  });

  it('removes only the watchlist-scoped realtime consumer on delete', async () => {
    const { service, watchlistRepository, kiwoomWebSocketService } =
      makeService();
    watchlistRepository.findOne.mockResolvedValue({
      watchlistId: '10',
      userId: 1,
      stockId: 2,
      stock: { ticker: '005930' },
    });
    watchlistRepository.remove.mockResolvedValue(undefined);
    kiwoomWebSocketService.isSubscribedStock.mockReturnValue(true);

    await service.remove(1, '10');

    expect(kiwoomWebSocketService.unsubscribeStocks).toHaveBeenCalledWith(
      ['005930'],
      'watchlist:1:10',
    );
  });
});
