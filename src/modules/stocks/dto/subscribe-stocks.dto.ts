import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsString,
} from 'class-validator';

export class SubscribeStocksDto {
  @ApiProperty({
    example: ['005930', '000660'],
    description: '실시간 시세를 구독할 종목코드 목록',
    type: [String],
  })
  @IsArray({ message: 'stockCodes는 배열이어야 합니다.' })
  @ArrayNotEmpty({
    message: 'stockCodes는 최소 1개 이상이어야 합니다.',
  })
  @IsString({
    each: true,
    message: '각 종목코드는 문자열이어야 합니다.',
  })
  stockCodes: string[];
}