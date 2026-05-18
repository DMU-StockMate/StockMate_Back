import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from './entities/stock.entity';
import { StockDetail } from './entities/stock-detail.entity';
import { StockPriceDaily } from './entities/stock-price-daily.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Stock,
      StockDetail,
      StockPriceDaily,
    ]),
  ],
  exports: [
    TypeOrmModule,
  ],
})
export class StocksModule {}