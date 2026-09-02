import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../users/guards/jwt-auth.guard';
import { CreateTradeDto } from '../dto/create-trade.dto';
import { RankingQueryDto } from '../dto/ranking-query.dto';
import { TradeHistoryQueryDto } from '../dto/trade-history-query.dto';
import { TradingService } from '../services/trading.service';

@ApiTags('trading')
@ApiBearerAuth('accessToken')
@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Get('account')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '내 거래 계좌 조회' })
  @ApiResponse({ status: 200, description: '거래 계좌 조회 성공' })
  findAccount(@Request() req) {
    return this.tradingService.findAccount(req.user.userId);
  }

  @Get('holdings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '내 보유 종목 조회' })
  @ApiResponse({ status: 200, description: '보유 종목 조회 성공' })
  findHoldings(@Request() req) {
    return this.tradingService.findHoldings(req.user.userId);
  }

  @Get('trades')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '내 거래 내역 조회' })
  @ApiResponse({ status: 200, description: '거래 내역 조회 성공' })
  findTrades(@Request() req, @Query() query: TradeHistoryQueryDto) {
    return this.tradingService.findTrades(req.user.userId, query);
  }

  @Get('rankings/assets')
  @ApiOperation({ summary: '자산 랭킹 조회' })
  @ApiResponse({ status: 200, description: '자산 랭킹 조회 성공' })
  findAssetRankings(@Query() query: RankingQueryDto) {
    return this.tradingService.findAssetRankings(query);
  }

  @Get('rankings/weekly-growth')
  @ApiOperation({ summary: '최근 일주일 상승 랭킹 조회' })
  @ApiResponse({ status: 200, description: '최근 일주일 상승 랭킹 조회 성공' })
  findWeeklyGrowthRankings(@Query() query: RankingQueryDto) {
    return this.tradingService.findWeeklyGrowthRankings(query);
  }

  @Post('buy')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '매수' })
  @ApiBody({ type: CreateTradeDto })
  @ApiResponse({ status: 201, description: '매수 성공' })
  buy(@Request() req, @Body() dto: CreateTradeDto) {
    return this.tradingService.buy(req.user.userId, dto);
  }

  @Post('sell')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '매도' })
  @ApiBody({ type: CreateTradeDto })
  @ApiResponse({ status: 201, description: '매도 성공' })
  sell(@Request() req, @Body() dto: CreateTradeDto) {
    return this.tradingService.sell(req.user.userId, dto);
  }
}
