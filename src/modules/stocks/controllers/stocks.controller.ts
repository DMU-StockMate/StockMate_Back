import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StockPriceQueryDto } from '../dto/stock-price-query.dto';
import { StockSearchQueryDto } from '../dto/stock-search-query.dto';
import { StocksService } from '../services/stocks.service';

@ApiTags('stocks')
@Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Get()
  @ApiOperation({ summary: '종목 목록 조회' })
  @ApiResponse({ status: 200, description: '종목 목록 조회 성공' })
  findAll(@Query() query: StockSearchQueryDto) {
    return this.stocksService.findAll(query);
  }

  @Get(':ticker/prices')
  @ApiOperation({ summary: '종목 일별 시세 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 200, description: '종목 일별 시세 조회 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  findDailyPrices(
    @Param('ticker') ticker: string,
    @Query() query: StockPriceQueryDto,
  ) {
    return this.stocksService.findDailyPrices(ticker, query);
  }

  @Get(':ticker/price/latest')
  @ApiOperation({ summary: '종목 최신 일별 시세 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 200, description: '종목 최신 일별 시세 조회 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  findLatestDailyPrice(@Param('ticker') ticker: string) {
    return this.stocksService.findLatestDailyPrice(ticker);
  }

  @Get(':ticker')
  @ApiOperation({ summary: '종목 상세 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 200, description: '종목 상세 조회 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  findByTicker(@Param('ticker') ticker: string) {
    return this.stocksService.findByTicker(ticker);
  }
}
