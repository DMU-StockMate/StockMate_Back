import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { StockMarket } from '../../enums/stock-market.enum';
import { StockStatus } from '../../enums/stock-status.enum';

export class StockSearchQueryDto {
  // 검색어
  @ApiPropertyOptional({
    example: '삼성',
    description: '종목명 또는 종목코드 검색어',
  })
  @IsOptional()
  @IsString({ message: '검색어는 문자열이어야 합니다.' })
  keyword?: string;

  // 시장 구분
  @ApiPropertyOptional({
    example: 'KOSPI',
    description: '시장 구분',
    enum: StockMarket,
  })
  @IsOptional()
  @IsEnum(StockMarket, { message: '시장 구분은 KOSPI, KOSDAQ, KONEX 중 하나여야 합니다.' })
  market?: StockMarket;

  // 종목 상태
  @ApiPropertyOptional({
    example: 'ACTIVE',
    description: '종목 상태',
    enum: StockStatus,
  })
  @IsOptional()
  @IsEnum(StockStatus, { message: '종목 상태는 ACTIVE, DELISTED, SUSPENDED 중 하나여야 합니다.' })
  status?: StockStatus;

  @ApiPropertyOptional({
    example: 1,
    description: '페이지 번호',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '페이지 번호는 정수여야 합니다.' })
  @Min(1, { message: '페이지 번호는 1 이상이어야 합니다.' })
  page?: number;

  @ApiPropertyOptional({
    example: 20,
    description: '페이지당 조회 개수',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '페이지당 조회 개수는 정수여야 합니다.' })
  @Min(1, { message: '페이지당 조회 개수는 1 이상이어야 합니다.' })
  @Max(100, { message: '페이지당 조회 개수는 100 이하여야 합니다.' })
  limit?: number;
}
