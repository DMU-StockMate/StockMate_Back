import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface KiwoomTokenResponse {
  expires_dt: string;
  token_type: string;
  token: string;
  return_code?: number;
  return_msg?: string;
}

@Injectable()
export class KiwoomAuthService {
  private readonly logger = new Logger(KiwoomAuthService.name);

  private accessToken: string | null = null;
  private expiresAt: Date | null = null;

  constructor(private readonly configService: ConfigService) {}

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.expiresAt && new Date() < this.expiresAt) {
      return this.accessToken;
    }

    return this.requestAccessToken();
  }

  private async requestAccessToken(): Promise<string> {
    const host =
      this.configService.get<string>('KIWOOM_API_HOST') ??
      'https://api.kiwoom.com';

    const appkey = this.configService.get<string>('KIWOOM_APP_KEY');
    const secretkey = this.configService.get<string>('KIWOOM_SECRET_KEY');

    if (!appkey || !secretkey) {
      throw new InternalServerErrorException(
        '키움 API 앱키 또는 시크릿키가 설정되지 않았습니다.',
      );
    }

    try {
      const response = await axios.post<KiwoomTokenResponse>(
        `${host}/oauth2/token`,
        {
          grant_type: 'client_credentials',
          appkey,
          secretkey,
        },
        {
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
          },
        },
      );

      const { token, expires_dt, return_code, return_msg } = response.data;

      if (return_code !== undefined && return_code !== 0) {
        throw new InternalServerErrorException(
          return_msg || '키움 접근토큰 발급에 실패했습니다.',
        );
      }

      if (!token) {
        throw new InternalServerErrorException(
          '키움 접근토큰 응답에 token이 없습니다.',
        );
      }

      this.accessToken = token;
      this.expiresAt = this.parseExpiresAt(expires_dt);

      this.logger.log('키움 접근토큰 발급 성공');

      return token;
    } catch (error: any) {
        this.logger.error(
            '키움 접근토큰 발급 실패',
            error.response?.data ?? error.message,
        );

        throw new InternalServerErrorException(
            '키움 접근토큰 발급 실패',
        );
    }
  }

   async revokeAccessToken(): Promise<void> {
    const host =
      this.configService.get<string>('KIWOOM_API_HOST') ??
      'https://api.kiwoom.com';

    const appkey = this.configService.get<string>('KIWOOM_APP_KEY');
    const secretkey = this.configService.get<string>('KIWOOM_SECRET_KEY');

    if (!appkey || !secretkey) {
      throw new InternalServerErrorException(
        '키움 API 앱키 또는 시크릿키가 설정되지 않았습니다.',
      );
    }

    try {
      const response = await axios.post<KiwoomTokenResponse>(
        `${host}/oauth2/revoke`,
        {
          appkey,
          secretkey,
          token: this.accessToken,
        },
        {
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
          },
        },
    );
    this.logger.log('키움 접근토큰 폐기 성공');
    } catch (error: any) {
        this.logger.warn(
        '키움 접근토큰 폐기 실패',
        error.response?.data ?? error.message,
        );
    } finally {
    this.accessToken = null;
    }

  }

  private parseExpiresAt(expiresDt: string): Date {
    if (!expiresDt || expiresDt.length < 14) {
      return new Date(Date.now() + 1000 * 60 * 30);
    }

    const year = Number(expiresDt.slice(0, 4));
    const month = Number(expiresDt.slice(4, 6)) - 1;
    const day = Number(expiresDt.slice(6, 8));
    const hour = Number(expiresDt.slice(8, 10));
    const minute = Number(expiresDt.slice(10, 12));
    const second = Number(expiresDt.slice(12, 14));

    return new Date(year, month, day, hour, minute, second);
  }

  clearToken(): void {
    this.accessToken = null;
    this.expiresAt = null;
  }
}