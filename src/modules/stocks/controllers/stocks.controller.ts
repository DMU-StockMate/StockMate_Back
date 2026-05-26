import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StockPriceQueryDto } from '../dto/stock-price-query.dto';
import { StockSearchQueryDto } from '../dto/stock-search-query.dto';
import { StocksService } from '../services/stocks.service';
import { SubscribeStocksDto } from '../dto/subscribe-stocks.dto';

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
  @Post('realtime/subscribe')
  @ApiOperation({
    summary: '실시간 시세 종목 구독',
    description:
      '종목 상세 화면 또는 매수/매도 화면 진입 시 해당 종목의 실시간 시세 수신을 시작합니다.',
  })
  @ApiBody({
    type: SubscribeStocksDto,
    description: '실시간 시세 구독 요청 종목코드 목록',
  })
  @ApiResponse({
    status: 201,
    description: '실시간 시세 구독 요청 성공',
    schema: {
      example: {
        message: '실시간 시세 구독 요청이 완료되었습니다.',
        stockCodes: ['005930', '000660'],
      },
    },
  })
  @ApiBadRequestResponse({
    description: `
- stockCodes는 배열이어야 합니다.
- stockCodes는 최소 1개 이상이어야 합니다.
- 각 종목코드는 문자열이어야 합니다.
    `,
  })
  @ApiInternalServerErrorResponse({
    description: `
- 키움 WebSocket이 연결되지 않았습니다.
- 실시간 시세 구독 요청 중 서버 오류가 발생했습니다.
    `,
  })
  subscribeRealtime(@Body() dto: SubscribeStocksDto) {
    return this.stocksService.subscribeRealtime(dto.stockCodes);
  }

  @Post('realtime/unsubscribe')
  @ApiOperation({
    summary: '실시간 시세 종목 구독 해제',
    description:
      '종목 상세 화면 또는 매수/매도 화면을 벗어날 때 해당 종목의 실시간 시세 수신을 중단합니다.',
  })
  @ApiBody({
    type: SubscribeStocksDto,
    description: '실시간 시세 구독 해제 종목코드 목록',
  })
  @ApiResponse({
    status: 201,
    description: '실시간 시세 구독 해제 요청 성공',
    schema: {
      example: {
        message: '실시간 시세 구독 해제 요청이 완료되었습니다.',
        stockCodes: ['005930', '000660'],
      },
    },
  })
  @ApiBadRequestResponse({
    description: `
- stockCodes는 배열이어야 합니다.
- stockCodes는 최소 1개 이상이어야 합니다.
- 각 종목코드는 문자열이어야 합니다.
    `,
  })
  @ApiInternalServerErrorResponse({
    description: `
- 키움 WebSocket이 연결되지 않았습니다.
- 실시간 시세 구독 해제 요청 중 서버 오류가 발생했습니다.
    `,
  })
  unsubscribeRealtime(@Body() dto: SubscribeStocksDto) {
    return this.stocksService.unsubscribeRealtime(dto.stockCodes);
  }

  @Get('realtime/prices')
  @ApiOperation({
    summary: '실시간 현재가 캐시 전체 조회',
    description:
      '현재 서버가 WebSocket으로 수신해 캐싱 중인 모든 종목의 현재가 목록을 조회합니다. 개발/확인용 API입니다.',
  })
  @ApiResponse({
    status: 200,
    description: '실시간 현재가 캐시 조회 성공',
    schema: {
      example: [
        {
          stockCode: '005930',
          price: 294500,
        },
        {
          stockCode: '000660',
          price: 1943000,
        },
      ],
    },
  })
  @ApiInternalServerErrorResponse({
    description: '서버 내부 오류',
  })
  getAllCurrentPrices() {
    return this.stocksService.getAllCurrentPrices();
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
  @ApiResponse({ status: 200, description: '투자 지표 조회 성공' })
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
  @Get(':ticker/realtime/price')
  @ApiOperation({ summary: '종목 실시간 가격 조회' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 200, description: '종목 실시간 가격 조회 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  getCurrentPrice(@Param('ticker') ticker: string) {
    return this.stocksService.getCurrentPrice(ticker);
  }
}
