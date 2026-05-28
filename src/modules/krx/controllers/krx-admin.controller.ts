import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { KrxService } from '../services/krx.service';
import { SyncDailyPriceQueryDto } from '../dto/sync-daily-price-query.dto';
import { SyncStockQueryDto } from '../dto/sync-stock-query.dto';
import { Roles } from '../../users/decorators/role-decorator';
import { JwtAuthGuard } from '../../users/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/guards/role-guard';
import { UserRole } from '../../enums/role-enum';

@ApiTags('Admin KRX')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/krx')
export class KrxAdminController {
  constructor(private readonly krxService: KrxService) {}

  // KRX 종목 기본정보 수집
  @Post('stocks/sync')
  @ApiOperation({ summary: 'KRX 종목 기본정보 수집' })
  syncAllStocks(@Query() query: SyncStockQueryDto) {
    return this.krxService.syncAllStocks(query.date);
  }

  // KRX 일별 시세 수집
  @Post('prices/sync')
  @ApiOperation({ summary: 'KRX 일별 시세 수집' })
  syncDailyPrices(@Query() query: SyncDailyPriceQueryDto) {
    return this.krxService.syncDailyPrices(query);
  }
}
