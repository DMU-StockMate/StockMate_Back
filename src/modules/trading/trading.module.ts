import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockPriceDaily } from '../stocks/entities/stock-price-daily.entity';
import { Stock } from '../stocks/entities/stock.entity';
import { StocksModule } from '../stocks/stocks.module';
import { AccountCashHistory } from './entities/account-cash-history.entity';
import { Holding } from './entities/holding.entity';
import { InvestmentOrder } from './entities/investment-order.entity';
import { Trade } from './entities/trade.entity';
import { TradingAccount } from './entities/trading-account.entity';
import { TradingController } from './controllers/trading.controller';
import { TradingService } from './services/trading.service';

@Module({
  imports: [
    StocksModule,
    TypeOrmModule.forFeature([
      TradingAccount,
      Holding,
      InvestmentOrder,
      Trade,
      AccountCashHistory,
      Stock,
      StockPriceDaily,
    ]),
  ],
  controllers: [TradingController],
  providers: [TradingService],
  exports: [TradingService],
})
export class TradingModule {}
