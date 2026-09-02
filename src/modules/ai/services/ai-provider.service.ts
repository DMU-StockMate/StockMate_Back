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
    const baseUrl = this.getBaseUrl();

    try {
      const response = await axios.post(
        `${baseUrl}/chat/stream`,
        params.context,
        {
          headers: this.getAuthHeaders(),
          responseType: 'stream',
        },
      );

      let fullText = '';
      let buffer = '';

      return await new Promise<string>((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf-8');

          const events = buffer.split('\n\n');
          // 마지막 조각은 아직 덜 도착했을 수 있으므로 남겨둠
          buffer = events.pop() ?? '';

          for (const event of events) {
            const lines = event
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.startsWith('data:'));

            for (const line of lines) {
              const dataText = line.replace(/^data:\s*/, '').trim();

              if (!dataText) {
                continue;
              }

              if (dataText === '[DONE]') {
                resolve(fullText);
                return;
              }

              try {
                const parsed = JSON.parse(dataText);

                if (parsed.type === 'token') {
                  const token = parsed.content ?? '';

                  fullText += token;
                  params.onToken(token);
                  continue;
                }

                if (parsed.type === 'error') {
                  reject(
                    new Error(parsed.message ?? 'AI 서버 스트리밍 오류'),
                  );
                  return;
                }

                // meta, done은 사용자 답변 본문이 아니므로 저장하지 않음
                if (parsed.type === 'meta' || parsed.type === 'done') {
                  continue;
                }
              } catch {
                console.error('AI SSE JSON 파싱 실패:', dataText);
              }
            }
          }
        });

        response.data.on('end', () => {
          resolve(fullText);
        });

        response.data.on('error', (error: unknown) => {
          reject(error);
        });
      });
    } catch (error: any) {
      console.error('AI 서버 요청 실패');
      console.error('status:', error.response?.status);
      console.error('message:', error.message);

      throw new InternalServerErrorException(
        'AI 서버 요청에 실패했습니다.',
      );
    }
  }

  async generateQuestion(context: unknown) {
    return this.postQuiz('/quiz/generate', context);
  }

  async generatePromptQuestion(context: unknown) {
    return this.postQuiz('/quiz/generate/prompt', context);
  }

  async generateReviewQuestion(context: unknown) {
    return this.postQuiz('/quiz/generate/review', context);
  }

  private getBaseUrl() {
    const baseUrl = this.configService.get<string>('LLAMA_API_URL');

    if (!baseUrl) {
      throw new InternalServerErrorException(
        'LLAMA_API_URL이 설정되지 않았습니다.',
      );
    }

    return baseUrl;
  }

  private async postQuiz(path: string, context: unknown) {
    const baseUrl = this.getBaseUrl();
    const response = await axios.post(`${baseUrl}${path}`, context, {
      headers: this.getAuthHeaders(),
    });

    return response.data;
  }

  private getAuthHeaders() {
    const apiKey = this.configService.get<string>('X-API-KEY');

    return apiKey
      ? {
          'X-API-Key': apiKey,
        }
      : undefined;
  }
}
