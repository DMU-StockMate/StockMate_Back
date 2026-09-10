import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../notification/notification.module';
import { StockPriceDaily } from '../stocks/entities/stock-price-daily.entity';
import { Stock } from '../stocks/entities/stock.entity';
import { TradingController } from './controllers/trading.controller';
import { AccountAssetSnapshot } from './entities/account-asset-snapshot.entity';
import { AccountCashHistory } from './entities/account-cash-history.entity';
import { Holding } from './entities/holding.entity';
import { Trade } from './entities/trade.entity';
import { TradingAccount } from './entities/trading-account.entity';
import { AccountAssetSnapshotSchedulerService } from './services/account-asset-snapshot-scheduler.service';
import { TradingService } from './services/trading.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TradingAccount,
      Holding,
      Trade,
      AccountCashHistory,
      AccountAssetSnapshot,
      Stock,
      StockPriceDaily,
    ]),
    NotificationModule,
  ],
  controllers: [TradingController],
  providers: [
    TradingService,
    AccountAssetSnapshotSchedulerService,
  ],
  exports: [TradingService],
})
export class TradingModule {}