import {
  Controller,
  Get,
  Param,
  Post,
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
  @ApiParam({ name: 'stockCode', example: '005930', description: '종목코드' })
  @ApiQuery({ name: 'businessYear', example: '2024', description: '사업연도' })
  @ApiQuery({
    name: 'reportCode',
    required: false,
    example: '11011',
    description:
      '보고서 코드: 11011 사업보고서, 11012 반기보고서, 11013 1분기보고서, 11014 3분기보고서',
  })
  @ApiResponse({ status: 200, description: 'AI 전달용 DART 컨텍스트 조회 성공' })
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

  @Post('stocks/:stockCode/sync-indicators')
  @ApiOperation({
    summary: 'DART 재무제표에서 투자 지표 계산 및 저장',
    description:
      'DART 연간 사업보고서의 재무제표를 파싱해 EPS, BPS, ROE, PER, PBR을 계산하고 ' +
      'stock_investment_indicators 테이블에 저장합니다. ' +
      'businessYear 미지정 시 직전 연도 → 2년 전 순으로 자동 시도합니다.',
  })
  @ApiParam({ name: 'stockCode', example: '005930', description: '종목코드' })
  @ApiQuery({
    name: 'businessYear',
    required: false,
    example: '2024',
    description: '사업연도 (기본값: 직전 연도 자동 시도)',
  })
  @ApiQuery({
    name: 'reportCode',
    required: false,
    example: '11011',
    description: '보고서 코드 (기본값: 11011 사업보고서)',
  })
  @ApiResponse({
    status: 201,
    description: '지표 계산·저장 성공',
    schema: {
      example: {
        ticker: '005930',
        corp: '삼성전자',
        businessYear: '2024',
        tradeDate: '2025-05-02',
        scale: 1000000,
        indicators: { eps: 1608.12, bps: 52341.5, roe: 3.07, per: 18.4, pbr: 0.56 },
      },
    },
  })
  syncIndicators(
    @Param('stockCode') stockCode: string,
    @Query('businessYear') businessYear?: string,
    @Query('reportCode') reportCode?: '11011' | '11012' | '11013' | '11014',
  ) {
    return this.dartService.syncIndicators(stockCode, businessYear, reportCode);
  }
}
