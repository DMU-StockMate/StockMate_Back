import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RankingQueryDto {
  @ApiPropertyOptional({
    example: 20,
    description: '조회 개수',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '조회 개수는 정수여야 합니다.' })
  @Min(1, { message: '조회 개수는 1 이상이어야 합니다.' })
  @Max(100, { message: '조회 개수는 100 이하여야 합니다.' })
  limit?: number;
}
