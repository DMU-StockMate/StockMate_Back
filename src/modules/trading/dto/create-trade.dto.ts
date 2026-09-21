import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  OrderSide,
  OrderType,
  TradingVenue,
} from '../entities/investment-order.entity';

export class CreateTradeDto {
  @ApiPropertyOptional({
    example: '005930',
    description: 'Stock code. Legacy ticker is still accepted.',
  })
  @IsOptional()
  @IsString()
  stockCode?: string;

  @ApiPropertyOptional({
    example: '005930',
    description: 'Legacy stock code field. stockCode takes precedence.',
  })
  @IsOptional()
  @IsString()
  ticker?: string;

  @ApiProperty({
    example: 10,
    description: 'Order quantity',
  })
  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer.' })
  @Min(1, { message: 'quantity must be at least 1.' })
  quantity!: number;

  @ApiPropertyOptional({
    enum: OrderType,
    default: OrderType.MARKET,
    description: 'Order type. Defaults to MARKET for legacy clients.',
  })
  @IsOptional()
  @IsEnum(OrderType)
  orderType?: OrderType;

  @ApiPropertyOptional({
    enum: OrderSide,
    description:
      'Order side. Existing /trading/buy and /trading/sell routes decide the side.',
  })
  @IsOptional()
  @IsEnum(OrderSide)
  side?: OrderSide;

  @ApiPropertyOptional({
    enum: TradingVenue,
    default: TradingVenue.KRX,
    description:
      'Trading venue. KRX keeps the existing schedule. NXT enables NXT pre/main/after sessions.',
  })
  @IsOptional()
  @IsEnum(TradingVenue)
  tradingVenue?: TradingVenue;

  @ApiPropertyOptional({
    example: 68000,
    description:
      'Limit price for LIMIT, STOP_LIMIT, CONDITIONAL_LIMIT, and LIMIT reservation orders. MARKET orders ignore this value.',
  })
  @ValidateIf((dto: CreateTradeDto) =>
    [
      OrderType.LIMIT,
      OrderType.STOP_LIMIT,
      OrderType.CONDITIONAL_LIMIT,
    ].includes(dto.orderType as OrderType) ||
    (dto.orderType === OrderType.RESERVATION &&
      dto.executionOrderType === OrderType.LIMIT),
  )
  @Type(() => Number)
  @IsNumber({}, { message: 'price must be a number.' })
  @Min(1, { message: 'price must be greater than 0.' })
  price?: number;

  @ApiPropertyOptional({
    example: 70000,
    description: 'Trigger price for STOP_LIMIT orders.',
  })
  @ValidateIf((dto: CreateTradeDto) => dto.orderType === OrderType.STOP_LIMIT)
  @Type(() => Number)
  @IsNumber({}, { message: 'stopPrice must be a number.' })
  @Min(1, { message: 'stopPrice must be greater than 0.' })
  stopPrice?: number;

  @ApiPropertyOptional({
    example: '2026-09-17T09:00:00+09:00',
    description:
      'Execution time for RESERVATION orders. Include a timezone offset, for example 2026-09-17T09:00:00+09:00.',
  })
  @ValidateIf((dto: CreateTradeDto) => dto.orderType === OrderType.RESERVATION)
  @IsDateString({}, { message: 'scheduledAt must be an ISO date string.' })
  scheduledAt?: string;

  @ApiPropertyOptional({
    enum: [OrderType.MARKET, OrderType.LIMIT, OrderType.AFTER_HOURS_CLOSE],
    description:
      'Actual order type to submit when a RESERVATION order reaches scheduledAt.',
  })
  @ValidateIf((dto: CreateTradeDto) => dto.orderType === OrderType.RESERVATION)
  @IsEnum(OrderType)
  executionOrderType?: OrderType;
}
