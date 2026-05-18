import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class KrxClient {
  private readonly authKey = process.env.KRX_AUTH_KEY;

  async get(url: string, params?: Record<string, string>) {
    if (!this.authKey) {
      throw new InternalServerErrorException('KRX 인증키가 설정되지 않았습니다.');
    }

    try {
      const response = await axios.get(url, {
        headers: {
          AUTH_KEY: this.authKey,
        },
        params,
      });

      return response.data;
    } catch (error: any) {
      console.error('KRX API 호출 실패');
      console.error('요청 URL:', url);
      console.error('요청 params:', params);
      console.error('응답 status:', error.response?.status);
      console.error('응답 data:', error.response?.data);
      console.error('에러 message:', error.message);

      throw new InternalServerErrorException('KRX API 호출 중 오류가 발생했습니다.');
    }
  }
}