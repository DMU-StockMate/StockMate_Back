import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter } from 'events';

import axios from 'axios';
import WebSocket from 'ws';

import { KiwoomAuthService } from './kiwoom-auth.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';
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

  // Simulation policy: keep one unified current price per stock code.
  // TradingVenue is handled by the trading module for session/eligibility checks,
  // not by maintaining separate KRX/NXT execution prices.
  private readonly currentPrices = new Map<string, number>();

  private readonly subscribedStocks = new Set<string>();

  private readonly subscriptionConsumers = new Map<string, Set<string>>();

  private readonly priceListeners = new Set<
    (stockCode: string, price: number) => void | Promise<void>
  >();

  private isManualClosed = false;

  constructor(
    private readonly kiwoomAuthService: KiwoomAuthService,
    private readonly configService: ConfigService,
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
              this.sendStockRegistration([...this.subscribedStocks]);
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

  subscribeStocks(stockCodes: string[], consumerId = 'default') {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new BadRequestException('WebSocket이 아직 연결되지 않았습니다.');
    }

    const newSubscriptions: string[] = [];

    stockCodes.forEach((stockCode) => {
      const consumers =
        this.subscriptionConsumers.get(stockCode) ?? new Set<string>();
      const wasSubscribed = this.subscribedStocks.has(stockCode);

      consumers.add(consumerId);
      this.subscriptionConsumers.set(stockCode, consumers);
      this.subscribedStocks.add(stockCode);

      if (!wasSubscribed) {
        newSubscriptions.push(stockCode);
      }
    });

    if (newSubscriptions.length === 0) {
      return;
    }

    const payload = {
      trnm: 'REG',
      grp_no: '1',
      refresh: '1',
      data: [
        {
          item: newSubscriptions,
          type: ['0B'],
        },
      ],
    };

    this.logger.log(`실시간 종목 구독 요청: ${stockCodes.join(', ')}`);
    this.logger.debug(JSON.stringify(payload));

    this.ws.send(JSON.stringify(payload));
  }

  private sendStockRegistration(stockCodes: string[]) {
    if (stockCodes.length === 0) {
      return;
    }

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

    this.ws?.send(JSON.stringify(payload));
  }

  isSubscribedStock(stockCode: string) {
    return this.subscribedStocks.has(stockCode);
  }

  registerPriceListener(
    listener: (stockCode: string, price: number) => void | Promise<void>,
  ) {
    this.priceListeners.add(listener);

    return () => {
      this.priceListeners.delete(listener);
    };
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

  unsubscribeStocks(stockCodes: string[], consumerId = 'default') {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new BadRequestException('WebSocket이 아직 연결되지 않았습니다.');
    }

    const removableSubscriptions: string[] = [];

    stockCodes.forEach((stockCode) => {
      const consumers = this.subscriptionConsumers.get(stockCode);
      if (!consumers) {
        return;
      }

      consumers.delete(consumerId);

      if (consumers.size === 0) {
        this.subscriptionConsumers.delete(stockCode);
        this.subscribedStocks.delete(stockCode);
        this.currentPrices.delete(stockCode);
        removableSubscriptions.push(stockCode);
      } else {
        this.subscriptionConsumers.set(stockCode, consumers);
      }
    });

    if (removableSubscriptions.length === 0) {
      return;
    }

    const referenceCountedPayload = {
      trnm: 'REMOVE',
      grp_no: '1',
      data: [
        {
          item: removableSubscriptions,
          type: ['0B'],
        },
      ],
    };

    this.logger.log(
      `realtime stock unsubscribe requested: ${removableSubscriptions.join(', ')}`,
    );
    this.ws.send(JSON.stringify(referenceCountedPayload));
    return;

    /*
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

    */
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

      for (const listener of this.priceListeners) {
        void Promise.resolve(listener(stockCode, absPrice)).catch(
          (error: unknown) => {
            this.logger.warn(
              `현재가 listener 처리 실패: ${stockCode} ${String(error)}`,
            );
          },
        );
      }

      this.logger.log(`현재가 갱신: ${stockCode} = ${absPrice}`);
      this.emit('tick', { stockCode, price: absPrice } satisfies StockTick);
    }
  }

  async getCurrentPrice(stockCode: string): Promise<number | null> {
    const memoryPrice = this.currentPrices.get(stockCode);

    if (this.isValidPrice(memoryPrice)) {
      return memoryPrice;
    }

    const redisPrice = await this.redis.get(`stock:price:${stockCode}`);

    if (!redisPrice) {
      return null;
    }

    const price = Number(redisPrice);
    return this.isValidPrice(price) ? price : null;
  }

  async getCurrentPriceWithRestFallback(
    stockCode: string,
  ): Promise<number | null> {
    const cachedPrice = await this.getCurrentPrice(stockCode);
    if (this.isValidPrice(cachedPrice)) {
      return cachedPrice;
    }

    const restPrice = await this.fetchCurrentPriceFromKiwoom(stockCode);
    if (!this.isValidPrice(restPrice)) {
      return null;
    }

    await this.cacheCurrentPrice(stockCode, restPrice);
    return restPrice;
  }

  getAllCurrentPrices() {
    return Array.from(this.currentPrices.entries()).map(
      ([stockCode, price]) => ({
        stockCode,
        price,
      }),
    );
  }

  private async fetchCurrentPriceFromKiwoom(stockCode: string) {
    const host =
      this.configService.get<string>('KIWOOM_API_HOST') ??
      'https://api.kiwoom.com';
    const path =
      this.configService.get<string>('KIWOOM_CURRENT_PRICE_PATH') ??
      '/api/dostk/stkinfo';
    const apiId =
      this.configService.get<string>('KIWOOM_CURRENT_PRICE_API_ID') ??
      'ka10001';
    const token = await this.kiwoomAuthService.getAccessToken();

    try {
      const response = await axios.post(
        `${host}${path}`,
        {
          stk_cd: stockCode,
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

      if (Number(response.data?.return_code ?? 0) !== 0) {
        return null;
      }

      return this.toPositiveNumber(response.data?.cur_prc);
    } catch (error) {
      this.logger.warn(
        `current price REST fallback failed stockCode=${stockCode}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async cacheCurrentPrice(stockCode: string, price: number) {
    this.currentPrices.set(stockCode, price);
    await this.redis.set(`stock:price:${stockCode}`, String(price), 'EX', 60);
  }

  private isValidPrice(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
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
