import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class RecommendedQuestionQueryDto {
  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  count?: number;

  @ApiPropertyOptional({
    example: 'mixed',
    enum: ['mixed', 'weakness', 'level', 'review'],
  })
  @IsOptional()
  @IsIn(['mixed', 'weakness', 'level', 'review'])
  mode?: 'mixed' | 'weakness' | 'level' | 'review';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  excludeSolved?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeReview?: boolean;
}
