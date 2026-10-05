import axios from 'axios';
import { KiwoomWebSocketService } from './kiwoom-websocket.service';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('KiwoomWebSocketService current price fallback', () => {
  const makeService = () => {
    const authService = {
      getAccessToken: jest.fn().mockResolvedValue('token'),
    };
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };

    return {
      service: new KiwoomWebSocketService(
        authService as any,
        configService as any,
        redis as any,
      ),
      authService,
      configService,
      redis,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses Kiwoom REST current price when websocket and Redis cache miss', async () => {
    const { service, redis } = makeService();
    mockedAxios.post.mockResolvedValue({
      data: {
        return_code: 0,
        cur_prc: '-70,000',
      },
    });

    await expect(
      service.getCurrentPriceWithRestFallback('005930'),
    ).resolves.toBe(70000);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.kiwoom.com/api/dostk/stkinfo',
      { stk_cd: '005930' },
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer token',
          'api-id': 'ka10001',
        }),
      }),
    );
    expect(redis.set).toHaveBeenCalledWith(
      'stock:price:005930',
      '70000',
      'EX',
      60,
    );
  });

  it('returns null when cache misses and Kiwoom REST current price fails', async () => {
    const { service } = makeService();
    mockedAxios.post.mockRejectedValue(new Error('timeout'));

    await expect(
      service.getCurrentPriceWithRestFallback('005930'),
    ).resolves.toBeNull();
  });
});
