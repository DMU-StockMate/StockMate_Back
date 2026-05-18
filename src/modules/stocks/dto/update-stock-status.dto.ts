import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { StockStatus } from '../../enums/stock-status.enum';

export class UpdateStockStatusDto {
  @ApiProperty({
    example: StockStatus.ACTIVE,
    description: '종목 상태',
    enum: StockStatus,
  })
  @IsEnum(StockStatus, {
    message: '종목 상태는 ACTIVE, DELISTED, SUSPENDED 중 하나여야 합니다.',
  })
  status!: StockStatus;

  @ApiPropertyOptional({
    example: true,
    description: '활성화 여부',
  })
  @IsOptional()
  @IsBoolean({ message: '활성화 여부는 boolean 값이어야 합니다.' })
  isActive?: boolean;
}
