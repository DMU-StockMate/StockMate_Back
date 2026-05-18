import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KrxClient } from './clients/krx.client';
import { KrxService } from './services/krx.service';
import { KrxAdminController } from './controllers/krx-admin.controller';
import { Stock } from '../stocks/entities/stock.entity';
import { StockDetail } from '../stocks/entities/stock-detail.entity';
import { StockPriceDaily } from '../stocks/entities/stock-price-daily.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Stock,
      StockDetail,
      StockPriceDaily,
    ]),
  ],
  controllers: [KrxAdminController],
  providers: [
    KrxClient,
    KrxService,
  ],
  exports: [KrxService],
})
export class KrxModule {}