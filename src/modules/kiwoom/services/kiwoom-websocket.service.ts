import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter } from 'events';

import WebSocket from 'ws';

import { KiwoomAuthService } from './kiwoom-auth.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface StockTick {
  stockCode: string;
  price: number;
}

@Injectable()
export class KiwoomWebSocketService
  extends EventEmitter
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KiwoomWebSocketService.name);

  private ws: WebSocket | null = null;

  private readonly currentPrices = new Map<string, number>();

  private readonly subscribedStocks = new Set<string>();

  private isManualClosed = false;

  constructor(
    private readonly kiwoomAuthService: KiwoomAuthService,
    @InjectRedis()
    private readonly redis: Redis,
  ) {
    super();
    // 종목별 스트림 구독자가 늘어도 경고 없이 emit할 수 있도록 상한을 넉넉히 둠
    this.setMaxListeners(0);
  }

  async onModuleInit() {
    try {
      await this.connect();
    } catch (error: any) {
      this.logger.error(
        '키움 WebSocket 초기 연결 실패',
        error.response?.data ?? error.message,
      );
    }
  }

  async onModuleDestroy() {
    this.isManualClosed = true;

    if (this.ws) {
      this.ws.close();
    }

    await this.kiwoomAuthService.revokeAccessToken?.();
  }

  private async connect() {
    const token = await this.kiwoomAuthService.getAccessToken();

    this.ws = new WebSocket('wss://api.kiwoom.com:10000/api/dostk/websocket', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    this.ws.on('open', () => {
      this.logger.log('키움 WebSocket 연결 성공');
      this.sendLogin();
    });

    this.ws.on('message', (data) => {
      const raw = data.toString();

      this.logger.debug(`키움 원본 수신: ${raw}`);

      try {
        const message = JSON.parse(raw);

        if (message.trnm === 'LOGIN') {
          if (message.return_code === 0) {
            this.logger.log('키움 WebSocket 로그인 성공');

            if (this.subscribedStocks.size > 0) {
              this.subscribeStocks([...this.subscribedStocks]);
            }
          } else {
            this.logger.error(
              `키움 WebSocket 로그인 실패: ${message.return_msg}`,
            );
          }

          return;
        }

        void this.handleMessage(message);
      } catch (error) {
        this.logger.warn(`JSON 파싱 실패: ${raw}`);
      }
    });

    this.ws.on('error', (error) => {
      this.logger.error('키움 WebSocket 오류', error);
    });

    this.ws.on('close', (code, reason) => {
      this.logger.warn(
        `키움 WebSocket 종료 code=${code}, reason=${reason.toString()}`,
      );

      if (!this.isManualClosed) {
        setTimeout(() => {
          this.logger.log('키움 WebSocket 재연결 시도');
          this.connect();
        }, 3000);
      }
    });
  }

  subscribeStocks(stockCodes: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new BadRequestException('WebSocket이 아직 연결되지 않았습니다.');
    }

    stockCodes.forEach((stockCode) => {
      this.subscribedStocks.add(stockCode);
    });

    const payload = {
      trnm: 'REG',
      grp_no: '1',
      refresh: '1',
      data: [
        {
          item: stockCodes,
          type: ['0B'],
        },
      ],
    };

    this.logger.log(`실시간 종목 구독 요청: ${stockCodes.join(', ')}`);
    this.logger.debug(JSON.stringify(payload));

    this.ws.send(JSON.stringify(payload));
  }

  isSubscribedStock(stockCode: string) {
    return this.subscribedStocks.has(stockCode);
  }

  private async sendLogin() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const token = await this.kiwoomAuthService.getAccessToken();

    const payload = {
      trnm: 'LOGIN',
      token,
    };

    this.logger.log('키움 WebSocket 로그인 요청');
    this.logger.debug(JSON.stringify(payload));

    this.ws.send(JSON.stringify(payload));
  }

  unsubscribeStocks(stockCodes: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new BadRequestException('WebSocket이 아직 연결되지 않았습니다.');
    }

    const notSubscribed = stockCodes.filter(
      (stockCode) => !this.subscribedStocks.has(stockCode),
    );

    if (notSubscribed.length > 0) {
      throw new BadRequestException(
        `구독 중인 종목이 아닙니다: ${notSubscribed.join(', ')}`,
      );
    }

    stockCodes.forEach((stockCode) => {
      this.subscribedStocks.delete(stockCode);
      this.currentPrices.delete(stockCode);
    });

    const payload = {
      trnm: 'REMOVE',
      grp_no: '1',
      data: [
        {
          item: stockCodes,
          type: ['0B'],
        },
      ],
    };

    this.logger.log(`실시간 종목 구독 해제: ${stockCodes.join(', ')}`);
    this.ws.send(JSON.stringify(payload));
  }

  private async handleMessage(message: any) {
    this.logger.log('키움 실시간 메시지 수신');
    //console.log(JSON.stringify(message, null, 2));

    const data = message?.data;

    if (!Array.isArray(data)) {
      return;
    }

    for (const item of data) {
      const stockCode = item?.item ?? item?.stockCode ?? item?.code;

      const priceValue =
        item?.values?.['10'] ??
        item?.values?.['현재가'] ??
        item?.price ??
        item?.currentPrice;

      if (!stockCode || priceValue === undefined) {
        continue;
      }

      const price = Number(String(priceValue).replace(/[^0-9.-]/g, ''));

      if (Number.isNaN(price)) {
        continue;
      }

      const absPrice = Math.abs(price);

      this.currentPrices.set(stockCode, absPrice);

      await this.redis.set(`stock:price:${stockCode}`, String(absPrice), 'EX', 60);
      this.logger.log(`현재가 갱신: ${stockCode} = ${absPrice}`);
      this.emit('tick', { stockCode, price: absPrice } satisfies StockTick);
    }
  }

  async getCurrentPrice(stockCode: string): Promise<number | null> {
    const memoryPrice = this.currentPrices.get(stockCode);

    if (memoryPrice) {
      return memoryPrice;
    }

    const redisPrice = await this.redis.get(`stock:price:${stockCode}`);

    if (!redisPrice) {
      return null;
    }

    return Number(redisPrice);
  }

  getAllCurrentPrices() {
    return Array.from(this.currentPrices.entries()).map(
      ([stockCode, price]) => ({
        stockCode,
        price,
      }),
    );
  }
}
