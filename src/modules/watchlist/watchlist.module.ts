import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from '../stocks/entities/stock.entity';
<<<<<<< HEAD
import { StocksModule } from '../stocks/stocks.module';
=======
>>>>>>> f171976 (feat: add watchlist API and improve profile management)
import { WatchlistController } from './controllers/watchlist.controller';
import { Watchlist } from './entities/watchlist.entity';
import { WatchlistService } from './services/watchlist.service';

@Module({
<<<<<<< HEAD
  imports: [TypeOrmModule.forFeature([Watchlist, Stock]), StocksModule],
=======
  imports: [TypeOrmModule.forFeature([Watchlist, Stock])],
>>>>>>> f171976 (feat: add watchlist API and improve profile management)
  controllers: [WatchlistController],
  providers: [WatchlistService],
})
export class WatchlistModule {}
