import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class NewsSummaryQueryDto {
  @ApiPropertyOptional({ example: '주식', description: '뉴스 검색어' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ example: 12, description: '조회 개수' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '조회 개수는 정수여야 합니다.' })
  @Min(1, { message: '조회 개수는 1 이상이어야 합니다.' })
  @Max(30, { message: '조회 개수는 30 이하여야 합니다.' })
  limit?: number;
}
