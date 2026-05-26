import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../users/guards/jwt-auth.guard';
import { CreateWatchlistDto } from '../dto/create-watchlist.dto';
import { WatchlistService } from '../services/watchlist.service';

@ApiTags('watchlist')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Post()
  @ApiOperation({ summary: '관심 종목 등록' })
  @ApiBody({ type: CreateWatchlistDto })
  @ApiResponse({ status: 201, description: '관심 종목 등록 성공' })
  create(@Request() req, @Body() dto: CreateWatchlistDto) {
    return this.watchlistService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: '내 관심 종목 목록 조회' })
  @ApiResponse({ status: 200, description: '관심 종목 목록 조회 성공' })
  findAll(@Request() req) {
    return this.watchlistService.findAll(req.user.userId);
  }

  @Get('check/:stockCode')
  @ApiOperation({ summary: '관심 종목 등록 여부 확인' })
  @ApiParam({ name: 'stockCode', example: '005930', description: '종목 코드' })
  @ApiResponse({ status: 200, description: '관심 종목 등록 여부 확인 성공' })
  check(@Request() req, @Param('stockCode') stockCode: string) {
    return this.watchlistService.check(req.user.userId, stockCode);
  }

  @Get(':watchlistId')
  @ApiOperation({ summary: '특정 관심 종목 상세 조회' })
  @ApiParam({ name: 'watchlistId', description: '관심 종목 ID' })
  @ApiResponse({ status: 200, description: '관심 종목 상세 조회 성공' })
  findOne(@Request() req, @Param('watchlistId') watchlistId: string) {
    return this.watchlistService.findOne(req.user.userId, watchlistId);
  }

  @Delete(':watchlistId')
  @ApiOperation({ summary: '관심 종목 삭제' })
  @ApiParam({ name: 'watchlistId', description: '관심 종목 ID' })
  @ApiResponse({ status: 200, description: '관심 종목 삭제 성공' })
  remove(@Request() req, @Param('watchlistId') watchlistId: string) {
    return this.watchlistService.remove(req.user.userId, watchlistId);
  }
}
