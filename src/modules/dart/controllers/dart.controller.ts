import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { DartService } from '../services/dart.service';

@ApiTags('dart')
@Controller('dart')
export class DartController {
  constructor(private readonly dartService: DartService) {}

  @Get('stocks/:stockCode/ai-context')
  @ApiOperation({
    summary: 'AI 전달용 DART 기업/재무 컨텍스트 조회',
    description:
      '종목코드를 기준으로 DART 기업 고유번호를 찾고, 주요 재무정보를 조회해 AI 서버에 전달하기 좋은 형태로 반환합니다.',
  })
  @ApiParam({
    name: 'stockCode',
    example: '005930',
    description: '종목코드',
  })
  @ApiQuery({
    name: 'businessYear',
    example: '2024',
    description: '사업연도',
  })
  @ApiQuery({
    name: 'reportCode',
    required: false,
    example: '11011',
    description:
      '보고서 코드: 11011 사업보고서, 11012 반기보고서, 11013 1분기보고서, 11014 3분기보고서',
  })
  @ApiResponse({
    status: 200,
    description: 'AI 전달용 DART 컨텍스트 조회 성공',
  })
  getStockAiContext(
    @Param('stockCode') stockCode: string,
    @Query('businessYear') businessYear: string,
    @Query('reportCode')
    reportCode?: '11011' | '11012' | '11013' | '11014',
  ) {
    return this.dartService.buildStockAiContext(
      stockCode,
      businessYear,
      reportCode ?? '11011',
    );
  }
}