
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class SyncDailyPriceQueryDto {
  @ApiPropertyOptional({
    example: '2026-05-15',
    description:
      'KRX 일별 시세를 수집할 단일 거래일. 생략하면 최근 10일 안에서 데이터가 있는 거래일을 사용합니다.',
  })
  @IsOptional()
  @IsDateString({}, { message: '거래일은 YYYY-MM-DD 형식이어야 합니다.' })
  date?: string;

  @ApiPropertyOptional({
    example: '2025-05-20',
    description: 'KRX 일별 시세 기간 수집 시작일',
  })
  @IsOptional()
  @IsDateString({}, { message: '시작일은 YYYY-MM-DD 형식이어야 합니다.' })
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-05-20',
    description: 'KRX 일별 시세 기간 수집 종료일',
  })
  @IsOptional()
  @IsDateString({}, { message: '종료일은 YYYY-MM-DD 형식이어야 합니다.' })
  endDate?: string;
}
