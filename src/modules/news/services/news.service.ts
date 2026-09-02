import { BadGatewayException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { NewsSummaryQueryDto } from '../dto/news-summary-query.dto';

@Injectable()
export class NewsService {
  async findLatestSummaries(query: NewsSummaryQueryDto) {
    const limit = query.limit ?? 12;
    const keyword = query.keyword?.trim() || '한국 주식';
    const url = 'https://news.google.com/rss/search';

    try {
      const { data } = await axios.get(url, {
        params: {
          q: keyword,
          hl: 'ko',
          gl: 'KR',
          ceid: 'KR:ko',
        },
        timeout: 7000,
        responseType: 'text',
      });

      const parsed = await parseStringPromise(data, { explicitArray: false });
      const items = parsed.rss?.channel?.item;
      const list = Array.isArray(items) ? items : items ? [items] : [];

      return list.slice(0, limit).map((item: any) => {
        const title = this.clean(item.title);
        const description = this.clean(item.description);
        const source = this.clean(item.source?._ ?? item.source);

        return {
          title,
          summary: this.summarize(description || title),
          source,
          url: item.link,
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        };
      });
    } catch {
      throw new BadGatewayException('최신 뉴스를 불러오지 못했습니다.');
    }
  }

  private summarize(text: string) {
    const cleaned = this.clean(text);
    if (cleaned.length <= 120) return cleaned;
    return `${cleaned.slice(0, 120).trim()}...`;
  }

  private clean(value: unknown) {
    return String(value ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
