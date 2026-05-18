import { Body, Controller, Delete, Param, Patch } from '@nestjs/common';
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UpdateStockDto } from '../dto/update-stock.dto';
import { UpdateStockStatusDto } from '../dto/update-stock-status.dto';
import { StocksService } from '../services/stocks.service';

@ApiTags('Admin Stocks')
@Controller('admin/stocks')
export class AdminStocksController {
  constructor(private readonly stocksService: StocksService) {}

  @Patch(':ticker')
  @ApiOperation({ summary: '종목 정보 수정' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiBody({ type: UpdateStockDto })
  @ApiResponse({ status: 200, description: '종목 정보 수정 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  update(
    @Param('ticker') ticker: string,
    @Body() updateStockDto: UpdateStockDto,
  ) {
    return this.stocksService.update(ticker, updateStockDto);
  }

  @Patch(':ticker/status')
  @ApiOperation({ summary: '종목 상태 변경' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiBody({ type: UpdateStockStatusDto })
  @ApiResponse({ status: 200, description: '종목 상태 변경 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  updateStatus(
    @Param('ticker') ticker: string,
    @Body() updateStockStatusDto: UpdateStockStatusDto,
  ) {
    return this.stocksService.updateStatus(ticker, updateStockStatusDto);
  }

  @Delete(':ticker')
  @ApiOperation({ summary: '종목 삭제 처리' })
  @ApiParam({
    name: 'ticker',
    example: '005930',
    description: '종목 코드',
  })
  @ApiResponse({ status: 200, description: '종목 삭제 처리 성공' })
  @ApiNotFoundResponse({ description: '종목을 찾을 수 없습니다.' })
  softDelete(@Param('ticker') ticker: string) {
    return this.stocksService.softDelete(ticker);
  }
}
