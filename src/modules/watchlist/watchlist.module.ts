import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from '../stocks/entities/stock.entity';
import { WatchlistController } from './controllers/watchlist.controller';
import { Watchlist } from './entities/watchlist.entity';
import { WatchlistService } from './services/watchlist.service';

@Module({
  imports: [TypeOrmModule.forFeature([Watchlist, Stock])],
  controllers: [WatchlistController],
  providers: [WatchlistService],
})
export class WatchlistModule {}
