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
import { TradeHistoryQueryDto } from '../dto/trade-history-query.dto';
import { TradingService } from '../services/trading.service';

@ApiTags('trading')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Get('account')
  @ApiOperation({ summary: '내 거래 계좌 조회' })
  @ApiResponse({ status: 200, description: '거래 계좌 조회 성공' })
  findAccount(@Request() req) {
    return this.tradingService.findAccount(req.user.userId);
  }

  @Get('holdings')
  @ApiOperation({ summary: '내 보유 종목 조회' })
  @ApiResponse({ status: 200, description: '보유 종목 조회 성공' })
  findHoldings(@Request() req) {
    return this.tradingService.findHoldings(req.user.userId);
  }

  @Get('trades')
  @ApiOperation({ summary: '내 거래 내역 조회' })
  @ApiResponse({ status: 200, description: '거래 내역 조회 성공' })
  findTrades(@Request() req, @Query() query: TradeHistoryQueryDto) {
    return this.tradingService.findTrades(req.user.userId, query);
  }

  @Post('buy')
  @ApiOperation({ summary: '매수' })
  @ApiBody({ type: CreateTradeDto })
  @ApiResponse({ status: 201, description: '매수 성공' })
  buy(@Request() req, @Body() dto: CreateTradeDto) {
    return this.tradingService.buy(req.user.userId, dto);
  }

  @Post('sell')
  @ApiOperation({ summary: '매도' })
  @ApiBody({ type: CreateTradeDto })
  @ApiResponse({ status: 201, description: '매도 성공' })
  sell(@Request() req, @Body() dto: CreateTradeDto) {
    return this.tradingService.sell(req.user.userId, dto);
  }
}
