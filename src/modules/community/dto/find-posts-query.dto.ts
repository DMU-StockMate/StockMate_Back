import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum CommunitySearchType {
  TITLE = 'title',
  CONTENT = 'content',
  ALL = 'all',
}

export enum CommunitySortType {
  LATEST = 'latest',
  VIEWS = 'views',
  LIKES = 'likes',
  COMMENTS = 'comments',
}

export class FindPostsQueryDto {
  @ApiPropertyOptional({ example: '삼성전자', description: '검색어' })
  @IsOptional()
  @IsString({ message: '검색어는 문자열이어야 합니다.' })
  keyword?: string;

  @ApiPropertyOptional({ enum: CommunitySearchType, description: '검색 대상' })
  @IsOptional()
  @IsEnum(CommunitySearchType, { message: 'searchType은 title, content, all 중 하나여야 합니다.' })
  searchType?: CommunitySearchType;

  @ApiPropertyOptional({ enum: CommunitySortType, description: '정렬 기준' })
  @IsOptional()
  @IsEnum(CommunitySortType, { message: 'sort는 latest, views, likes, comments 중 하나여야 합니다.' })
  sort?: CommunitySortType;

  @ApiPropertyOptional({ example: 1, description: '페이지 번호' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '페이지 번호는 정수여야 합니다.' })
  @Min(1, { message: '페이지 번호는 1 이상이어야 합니다.' })
  page?: number;

  @ApiPropertyOptional({ example: 20, description: '페이지당 조회 개수' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '페이지당 조회 개수는 정수여야 합니다.' })
  @Min(1, { message: '페이지당 조회 개수는 1 이상이어야 합니다.' })
  @Max(100, { message: '페이지당 조회 개수는 100 이하여야 합니다.' })
  limit?: number;
}
