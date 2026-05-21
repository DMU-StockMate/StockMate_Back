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

  @Get('all')
  @ApiOperation({ summary: '전체 종목 조회' })
  @ApiResponse({ status: 200, description: '전체 종목 조회 성공' })
  findAllStocks(@Query() query: StockSearchQueryDto) {
    return this.stocksService.findAllStocks(query);
  }

  @Get('search')
  @ApiOperation({ summary: '종목 검색' })
  @ApiResponse({ status: 200, description: '종목 검색 성공' })
  search(@Query() query: StockSearchQueryDto) {
    return this.stocksService.search(query);
  }

  @Get('markets')
  @ApiOperation({ summary: '시장 구분 조회' })
  @ApiResponse({ status: 200, description: '시장 구분 조회 성공' })
  findMarkets() {
    return this.stocksService.findMarkets();
  }

  @Get('rankings/rise')
  @ApiOperation({ summary: '상승률 상위 종목 조회' })
  @ApiResponse({ status: 200, description: '상승률 상위 종목 조회 성공' })
  findRiseRankings(@Query('limit') limit?: string) {
    return this.stocksService.findRiseRankings(Number(limit ?? 20));
  }

  @Get('rankings/fall')
  @ApiOperation({ summary: '하락률 상위 종목 조회' })
  @ApiResponse({ status: 200, description: '하락률 상위 종목 조회 성공' })
  findFallRankings(@Query('limit') limit?: string) {
    return this.stocksService.findFallRankings(Number(limit ?? 20));
  }

  @Get('rankings/volume')
  @ApiOperation({ summary: '거래량 상위 종목 조회' })
  @ApiResponse({ status: 200, description: '거래량 상위 종목 조회 성공' })
  findVolumeRankings(@Query('limit') limit?: string) {
    return this.stocksService.findVolumeRankings(Number(limit ?? 20));
  }

  @Get('sectors')
  @ApiOperation({ summary: '업종 목록 조회' })
  @ApiResponse({ status: 200, description: '업종 목록 조회 성공' })
  findSectors() {
    return this.stocksService.findSectors();
  }

  @Get('sectors/:sectorId')
  @ApiOperation({ summary: '특정 업종 종목 조회' })
  @ApiParam({
    name: 'sectorId',
    example: '반도체',
    description: '업종명',
  })
  @ApiResponse({ status: 200, description: '특정 업종 종목 조회 성공' })
  findStocksBySector(
    @Param('sectorId') sectorId: string,
    @Query() query: StockSearchQueryDto,
  ) {
    return this.stocksService.findStocksBySector(sectorId, query);
  }

  @Get(':ticker/price')
  @ApiOperation({ summary: '종목 현재가 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 200, description: '종목 현재가 조회 성공' })
  @ApiNotFoundResponse({ description: '종목 또는 시세를 찾을 수 없습니다.' })
  findCurrentPrice(@Param('ticker') ticker: string) {
    return this.stocksService.findCurrentPrice(ticker);
  }

  @Get(':ticker/summary')
  @ApiOperation({ summary: '종목 요약 정보 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 200, description: '종목 요약 정보 조회 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  findSummary(@Param('ticker') ticker: string) {
    return this.stocksService.findSummary(ticker);
  }

  @Get(':ticker/chart')
  @ApiOperation({ summary: '종목 차트 데이터 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 200, description: '종목 차트 데이터 조회 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  findChart(
    @Param('ticker') ticker: string,
    @Query() query: StockPriceQueryDto,
  ) {
    return this.stocksService.findChart(ticker, query);
  }

  @Get(':ticker/chart/daily')
  @ApiOperation({ summary: '일봉 차트 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 200, description: '일봉 차트 조회 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  findDailyChart(
    @Param('ticker') ticker: string,
    @Query() query: StockPriceQueryDto,
  ) {
    return this.stocksService.findDailyChart(ticker, query);
  }

  @Get(':ticker/chart/weekly')
  @ApiOperation({ summary: '주봉 차트 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 200, description: '주봉 차트 조회 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  findWeeklyChart(
    @Param('ticker') ticker: string,
    @Query() query: StockPriceQueryDto,
  ) {
    return this.stocksService.findWeeklyChart(ticker, query);
  }

  @Get(':ticker/chart/monthly')
  @ApiOperation({ summary: '월봉 차트 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 200, description: '월봉 차트 조회 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  findMonthlyChart(
    @Param('ticker') ticker: string,
    @Query() query: StockPriceQueryDto,
  ) {
    return this.stocksService.findMonthlyChart(ticker, query);
  }

  @Get(':ticker/ohlcv')
  @ApiOperation({ summary: 'OHLCV 데이터 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 200, description: 'OHLCV 데이터 조회 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  findOhlcv(
    @Param('ticker') ticker: string,
    @Query() query: StockPriceQueryDto,
  ) {
    return this.stocksService.findOhlcv(ticker, query);
  }

  @Get(':ticker/financials')
  @ApiOperation({ summary: '재무 정보 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 501, description: '재무 정보 테이블 미구현' })
  findFinancials(@Param('ticker') ticker: string) {
    return this.stocksService.findFinancials(ticker);
  }

  @Get(':ticker/indicators')
  @ApiOperation({ summary: '투자 지표 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 501, description: '투자 지표 테이블 미구현' })
  findIndicators(@Param('ticker') ticker: string) {
    return this.stocksService.findIndicators(ticker);
  }

  @Get(':ticker/dividends')
  @ApiOperation({ summary: '배당 정보 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 501, description: '배당 정보 테이블 미구현' })
  findDividends(@Param('ticker') ticker: string) {
    return this.stocksService.findDividends(ticker);
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
