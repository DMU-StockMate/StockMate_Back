import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class SyncStockQueryDto {
  @ApiPropertyOptional({
    example: '2026-01-02',
    description:
      'KRX 종목 기본정보를 수집할 기준일. 생략하면 최근 10일 안에서 데이터가 있는 기준일을 사용합니다.',
  })
  @IsOptional()
  @IsDateString({}, { message: '기준일은 YYYY-MM-DD 형식이어야 합니다.' })
  date?: string;
}
