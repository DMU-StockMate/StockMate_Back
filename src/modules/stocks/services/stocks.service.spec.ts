import { StocksService } from './stocks.service';

describe('StocksService', () => {
  it('returns the latest limited chart prices in ascending order', async () => {
    const rows = [
      { stockId: 1, tradeDate: '2026-07-30' },
      { stockId: 1, tradeDate: '2026-07-29' },
    ];
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    const service = new StocksService(
      {
        findOne: jest.fn().mockResolvedValue({
          stockId: 1,
          ticker: '005930',
          companyName: '삼성전자',
        }),
      } as any,
      {} as any,
      { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const chart = await service.findDailyChart('005930', { limit: 2 });

    expect(queryBuilder.orderBy).toHaveBeenCalledWith('price.tradeDate', 'DESC');
    expect(chart.prices.map((price) => price.tradeDate)).toEqual([
      '2026-07-29',
      '2026-07-30',
    ]);
  });
});
