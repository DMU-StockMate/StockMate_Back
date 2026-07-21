import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DartController } from './controllers/dart.controller';
import { DartService } from './services/dart.service';
import { Stock } from '../stocks/entities/stock.entity';
import { StockPriceDaily } from '../stocks/entities/stock-price-daily.entity';
import { StockInvestmentIndicator } from '../stocks/entities/stock-investment-indicator.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Stock, StockPriceDaily, StockInvestmentIndicator]),
  ],
  controllers: [DartController],
  providers: [DartService],
  exports: [DartService],
})
export class DartModule {}
