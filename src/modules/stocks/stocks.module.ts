import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from './entities/stock.entity';
import { StockDetail } from './entities/stock-detail.entity';
import { StockPriceDaily } from './entities/stock-price-daily.entity';
import { AdminStocksController } from './controllers/admin-stocks.controller';
import { StocksController } from './controllers/stocks.controller';
import { StocksService } from './services/stocks.service';
import { KiwoomAuthService } from '../kiwoom/services/kiwoom-auth.service';
import { KiwoomWebSocketService } from '../kiwoom/services/kiwoom-websocket.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Stock,
      StockDetail,
      StockPriceDaily,
    ]),
  ],
  controllers: [StocksController, AdminStocksController],
  providers: [StocksService, KiwoomWebSocketService, KiwoomAuthService],
  exports: [
    TypeOrmModule,
    StocksService,
    KiwoomWebSocketService,
    KiwoomAuthService,
  ],
})
export class StocksModule {}
