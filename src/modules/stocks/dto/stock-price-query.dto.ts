import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class StockPriceQueryDto {
  // 시작 날짜
  @ApiPropertyOptional({
    example: '2026-05-01',
    description: '조회 시작 날짜',
  })
  @IsOptional()
  @IsDateString({}, { message: '시작 날짜는 YYYY-MM-DD 형식이어야 합니다.' })
  startDate?: string;

  // 종료 날짜
  @ApiPropertyOptional({
    example: '2026-05-18',
    description: '조회 종료 날짜',
  })
  @IsOptional()
  @IsDateString({}, { message: '종료 날짜는 YYYY-MM-DD 형식이어야 합니다.' })
  endDate?: string;
}