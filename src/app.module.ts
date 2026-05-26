import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './modules/users/users.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { AdminModule } from './modules/users/admin.module';
import { LearningModule } from './modules/learning/learning.module';
import { KrxModule } from './modules/krx/krx.module';
import { StocksModule } from './modules/stocks/stocks.module';
import { TradingModule } from './modules/trading/trading.module';

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
    KrxModule,
    StocksModule,
    TradingModule,
  ],
})
export class AppModule {}
