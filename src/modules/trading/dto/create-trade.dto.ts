import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateTradeDto {
  @ApiProperty({
    example: '005930',
    description: '종목 코드',
  })
  @IsString({ message: '종목 코드는 문자열이어야 합니다.' })
  ticker!: string;

  @ApiProperty({
    example: 10,
    description: '주문 수량',
  })
  @Type(() => Number)
  @IsInt({ message: '주문 수량은 정수여야 합니다.' })
  @Min(1, { message: '주문 수량은 1 이상이어야 합니다.' })
  quantity!: number;

  @ApiPropertyOptional({
    example: 72000,
    description: '주문 가격입니다. 생략하면 최신 종가로 체결합니다.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '주문 가격은 숫자여야 합니다.' })
  @Min(1, { message: '주문 가격은 1 이상이어야 합니다.' })
  price?: number;
}
