import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

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

  @ApiPropertyOptional({
    example: 90,
    description: '조회 개수',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '조회 개수는 정수여야 합니다.' })
  @Min(1, { message: '조회 개수는 1 이상이어야 합니다.' })
  @Max(500, { message: '조회 개수는 500 이하여야 합니다.' })
  limit?: number;
}
