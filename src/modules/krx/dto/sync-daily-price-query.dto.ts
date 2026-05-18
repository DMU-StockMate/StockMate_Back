
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class SyncDailyPriceQueryDto {
  @ApiPropertyOptional({
    example: '2026-05-15',
    description:
      'KRX 일별 시세를 수집할 거래일. 생략하면 최근 10일 안에서 데이터가 있는 거래일을 사용합니다.',
  })
  @IsOptional()
  @IsDateString({}, { message: '거래일은 YYYY-MM-DD 형식이어야 합니다.' })
  date?: string;
}
