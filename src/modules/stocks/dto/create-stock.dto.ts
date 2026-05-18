import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { StockMarket } from '../../enums/stock-market.enum';
import { StockStatus } from '../../enums/stock-status.enum';

export class CreateStockDto {
  @ApiProperty({
    example: '005930',
    description: '종목 코드',
  })
  @IsString({ message: '종목 코드는 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '종목 코드는 필수입니다.' })
  @Length(1, 20, { message: '종목 코드는 1자 이상 20자 이하로 입력해주세요.' })
  ticker!: string;

  @ApiProperty({
    example: '삼성전자',
    description: '회사명',
  })
  @IsString({ message: '회사명은 문자열이어야 합니다.' })
  @IsNotEmpty({ message: '회사명은 필수입니다.' })
  @Length(1, 100, { message: '회사명은 1자 이상 100자 이하로 입력해주세요.' })
  companyName!: string;

  @ApiPropertyOptional({
    example: StockMarket.KOSPI,
    description: '시장 구분',
    enum: StockMarket,
  })
  @IsOptional()
  @IsEnum(StockMarket, {
    message: '시장 구분은 KOSPI, KOSDAQ, KONEX 중 하나여야 합니다.',
  })
  market?: StockMarket;

  @ApiPropertyOptional({
    example: '전기전자',
    description: '업종',
  })
  @IsOptional()
  @IsString({ message: '업종은 문자열이어야 합니다.' })
  @Length(1, 50, { message: '업종은 1자 이상 50자 이하로 입력해주세요.' })
  sector?: string;

  @ApiPropertyOptional({
    example: 'KRW',
    description: '통화',
  })
  @IsOptional()
  @IsString({ message: '통화는 문자열이어야 합니다.' })
  @Length(1, 10, { message: '통화는 1자 이상 10자 이하로 입력해주세요.' })
  currency?: string;

  @ApiPropertyOptional({
    example: StockStatus.ACTIVE,
    description: '종목 상태',
    enum: StockStatus,
  })
  @IsOptional()
  @IsEnum(StockStatus, {
    message: '종목 상태는 ACTIVE, DELISTED, SUSPENDED 중 하나여야 합니다.',
  })
  status?: StockStatus;

  @ApiPropertyOptional({
    example: true,
    description: '활성화 여부',
  })
  @IsOptional()
  @IsBoolean({ message: '활성화 여부는 boolean 값이어야 합니다.' })
  isActive?: boolean;

  @ApiPropertyOptional({
    example: '반도체 및 스마트폰 제조',
    description: '종목 설명',
  })
  @IsOptional()
  @IsString({ message: '종목 설명은 문자열이어야 합니다.' })
  description?: string;

  @ApiPropertyOptional({
    example: '홍길동',
    description: '대표자명',
  })
  @IsOptional()
  @IsString({ message: '대표자명은 문자열이어야 합니다.' })
  @Length(1, 50, { message: '대표자명은 1자 이상 50자 이하로 입력해주세요.' })
  ceoName?: string;

  @ApiPropertyOptional({
    example: '전자제품 제조업',
    description: '상세 업종',
  })
  @IsOptional()
  @IsString({ message: '상세 업종은 문자열이어야 합니다.' })
  @Length(1, 100, { message: '상세 업종은 1자 이상 100자 이하로 입력해주세요.' })
  industryDetail?: string;

  @ApiPropertyOptional({
    example: '1975-06-11',
    description: '상장일',
  })
  @IsOptional()
  @IsDateString({}, { message: '상장일은 YYYY-MM-DD 형식이어야 합니다.' })
  listingDate?: string;

  @ApiPropertyOptional({
    example: '5969782550',
    description: '상장 주식 수',
  })
  @IsOptional()
  @IsString({ message: '상장 주식 수는 문자열이어야 합니다.' })
  totalShares?: string;

  @ApiPropertyOptional({
    example: 'https://www.samsung.com',
    description: '홈페이지 URL',
  })
  @IsOptional()
  @IsString({ message: '홈페이지 URL은 문자열이어야 합니다.' })
  @Length(1, 255, { message: '홈페이지 URL은 1자 이상 255자 이하로 입력해주세요.' })
  homepageUrl?: string;
}
