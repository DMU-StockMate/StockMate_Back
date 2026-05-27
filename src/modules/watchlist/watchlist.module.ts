import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockPriceDaily } from '../stocks/entities/stock-price-daily.entity';
import { Stock } from '../stocks/entities/stock.entity';
import { StocksModule } from '../stocks/stocks.module';
import { WatchlistController } from './controllers/watchlist.controller';
import { Watchlist } from './entities/watchlist.entity';
import { WatchlistService } from './services/watchlist.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Watchlist, Stock, StockPriceDaily]),
    StocksModule,
  ],
  controllers: [WatchlistController],
  providers: [WatchlistService],
})
export class WatchlistModule {}
