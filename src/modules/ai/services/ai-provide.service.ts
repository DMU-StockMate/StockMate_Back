import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AiLlamaProviderService {
  constructor(private readonly configService: ConfigService) {}

  async streamChat(params: {
    context: unknown;
    onToken: (token: string) => void;
  }): Promise<string> {
    const baseUrl = this.configService.get<string>('LLAMA_API_URL');

    if (!baseUrl) {
      throw new InternalServerErrorException(
        'LLAMA_API_URL이 설정되지 않았습니다.',
      );
    }

    let fullText = '';

    const response = await axios.post(
      `${baseUrl}/chat/stream`,
      params.context,
      {
        responseType: 'stream',
      },
    );

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk: Buffer) => {
        const text = chunk.toString();

        fullText += text;
        params.onToken(text);
      });

      response.data.on('end', () => {
        resolve(fullText);
      });

      response.data.on('error', (error: unknown) => {
        reject(error);
      });
    });
  }

// // 연결 전 정상 동작 테스트
// async streamChat(params: {
//   context: unknown;
//   onToken: (token: string) => void;
// }): Promise<string> {

//   const fakeResponse = [
//     'PER은 ',
//     '기업의 ',
//     '수익 대비 ',
//     '주가 수준을 ',
//     '의미합니다.'
//   ];

//   let fullText = '';

//   for (const token of fakeResponse) {
//     fullText += token;

//     params.onToken(token);

//     await new Promise(resolve =>
//       setTimeout(resolve, 300),
//     );
//   }

//   return fullText;
// }
}