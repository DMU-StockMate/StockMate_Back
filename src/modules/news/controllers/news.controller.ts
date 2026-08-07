import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NewsSummaryQueryDto } from '../dto/news-summary-query.dto';
import { NewsService } from '../services/news.service';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('summaries')
  @ApiOperation({ summary: '최신 뉴스 요약 조회' })
  @ApiResponse({ status: 200, description: '최신 뉴스 요약 조회 성공' })
  findLatestSummaries(@Query() query: NewsSummaryQueryDto) {
    return this.newsService.findLatestSummaries(query);
  }
}
