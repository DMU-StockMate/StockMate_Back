import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class FindQuestionsQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: '기존 호환용 카테고리 ID',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'topicId는 정수여야 합니다.' })
  @Min(1, { message: 'topicId는 1 이상이어야 합니다.' })
  topicId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: '퀴즈 카테고리 ID로 필터링',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'categoryId는 정수여야 합니다.' })
  @Min(1, { message: 'categoryId는 1 이상이어야 합니다.' })
  categoryId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: '투자 레벨 ID로 필터링 (1=초급, 2=중급, 3=고급)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'investmentLevelId는 정수여야 합니다.' })
  @Min(1, { message: 'investmentLevelId는 1 이상이어야 합니다.' })
  investmentLevelId?: number;
}
