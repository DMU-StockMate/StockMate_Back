import { RedisModule } from '@nestjs-modules/ioredis';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './modules/ai/ai.module';
import { CommunityModule } from './modules/community/community.module';
import { DartModule } from './modules/dart/dart.module';
import { InvestmentProfileModule } from './modules/investment-profile/investment-profile.module';
import { KrxModule } from './modules/krx/krx.module';
import { LearningModule } from './modules/learning/learning.module';
import { NewsModule } from './modules/news/news.module';
import { StocksModule } from './modules/stocks/stocks.module';
import { TradingModule } from './modules/trading/trading.module';
import { AdminModule } from './modules/users/admin.module';
import { UsersModule } from './modules/users/users.module';
import { WatchlistModule } from './modules/watchlist/watchlist.module';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    //redis 모듈 추가
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: `redis://${configService.get('REDIS_HOST')}:${configService.get('REDIS_PORT')}`,
      }),
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: true,
      }),
    }),

    UsersModule,
    AdminModule,
    LearningModule,
    InvestmentProfileModule,
    KrxModule,
    StocksModule,
    AiModule,
    DartModule,
    TradingModule,
    WatchlistModule,
    CommunityModule,
    NewsModule,
    NotificationModule,
  ],
})
export class AppModule {}
