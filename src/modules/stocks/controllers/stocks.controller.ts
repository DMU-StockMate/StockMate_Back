import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateStockDto } from '../dto/create-stock.dto';
import { StockPriceQueryDto } from '../dto/stock-price-query.dto';
import { StockSearchQueryDto } from '../dto/stock-search-query.dto';
import { StocksService } from '../services/stocks.service';

@ApiTags('stocks')
@Controller('stocks')
export class StocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Post()
  @ApiOperation({ summary: '종목 생성' })
  @ApiBody({ type: CreateStockDto })
  @ApiCreatedResponse({ description: '종목 생성 성공' })
  @ApiConflictResponse({ description: '이미 등록된 종목 코드입니다.' })
  create(@Body() createStockDto: CreateStockDto) {
    return this.stocksService.create(createStockDto);
  }

  @Get()
  @ApiOperation({ summary: '종목 목록 조회' })
  @ApiResponse({ status: 200, description: '종목 목록 조회 성공' })
  findAll(@Query() query: StockSearchQueryDto) {
    return this.stocksService.findAll(query);
  }

  @Get('ticker/:ticker')
  @ApiOperation({ summary: '종목 코드로 종목 상세 조회' })
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

  @Get(':stockId')
  @ApiOperation({ summary: '종목 상세 조회' })
  @ApiParam({
    name: 'stockId',
    type: Number,
    description: '종목 ID',
  })
  @ApiResponse({ status: 200, description: '종목 상세 조회 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  findOne(@Param('stockId', ParseIntPipe) stockId: number) {
    return this.stocksService.findOne(stockId);
  }

  @Get(':stockId/prices')
  @ApiOperation({ summary: '종목 일별 시세 조회' })
  @ApiParam({
    name: 'stockId',
    type: Number,
    description: '종목 ID',
  })
  @ApiResponse({ status: 200, description: '종목 일별 시세 조회 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  findDailyPrices(
    @Param('stockId', ParseIntPipe) stockId: number,
    @Query() query: StockPriceQueryDto,
  ) {
    return this.stocksService.findDailyPrices(stockId, query);
  }
}
