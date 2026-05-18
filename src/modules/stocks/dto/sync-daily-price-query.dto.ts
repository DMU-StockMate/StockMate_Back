
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

export class SyncDailyPriceQueryDto {
  // 거래일
  @ApiProperty({
    example: '2026-05-18',
    description: 'KRX 일별 시세를 수집할 거래일',
  })
  @IsNotEmpty({ message: '거래일은 필수입니다.' })
  @IsDateString({}, { message: '거래일은 YYYY-MM-DD 형식이어야 합니다.' })
  date!: string;
}