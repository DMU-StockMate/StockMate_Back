import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { OrderSide, OrderType } from '../entities/investment-order.entity';

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
    example: 68000,
    description:
      'Limit price for LIMIT orders only. MARKET orders ignore this value.',
  })
  @ValidateIf((dto: CreateTradeDto) => dto.orderType === OrderType.LIMIT)
  @Type(() => Number)
  @IsNumber({}, { message: 'price must be a number.' })
  @Min(1, { message: 'price must be greater than 0.' })
  price?: number;
}
