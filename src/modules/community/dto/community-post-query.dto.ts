import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CommunityPostQueryDto {
  @ApiPropertyOptional({ example: '삼성전자' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    example: 'all',
    enum: ['title', 'content', 'all'],
  })
  @IsOptional()
  @IsIn(['title', 'content', 'all'])
  searchType?: 'title' | 'content' | 'all';

  @ApiPropertyOptional({
    example: 'latest',
    enum: ['latest', 'views', 'likes', 'comments'],
  })
  @IsOptional()
  @IsIn(['latest', 'views', 'likes', 'comments'])
  sort?: 'latest' | 'views' | 'likes' | 'comments';

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
