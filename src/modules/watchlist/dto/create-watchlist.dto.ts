import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateWatchlistDto {
  @ApiProperty({
    example: '005930',
    description: '관심 종목으로 등록할 종목 코드',
  })
  @IsString({ message: '종목 코드는 문자열이어야 합니다.' })
  stockCode!: string;
}
