import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/users/guards/jwt-auth.guard';
import { InvestmentProfileService } from '../services/investment-profile.service';
import { SubmitInvestmentProfileDto } from '../dto/submit-investment-profile.dto';

@ApiTags('investment-profile')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('users/investment-profile')
export class InvestmentProfileController {
  constructor(
    private readonly investmentProfileService: InvestmentProfileService,
  ) {}

  @Post()
  @ApiOperation({
    summary: '투자성향·학습 수준 진단 제출',
    description:
      '온보딩 문항 응답(선택지 코드)을 제출하면 서버가 투자성향 점수와 지식 점수를 계산해 저장합니다. 재진단 시 기존 결과를 덮어씁니다.',
  })
  @ApiBody({ type: SubmitInvestmentProfileDto })
  @ApiResponse({ status: 201, description: '진단 결과 저장 성공' })
  @ApiBadRequestResponse({
    description: `
- answers 개수가 10개가 아닙니다.
- 답변하지 않은 문항이 있습니다.
- 존재하지 않는 문항 코드 또는 선택지 코드입니다.
- 동일한 문항에 중복 응답했습니다.
    `,
  })
  @ApiUnauthorizedResponse({ description: 'accessToken 없음 또는 만료' })
  submit(@Req() req, @Body() dto: SubmitInvestmentProfileDto) {
    return this.investmentProfileService.submit(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: '투자성향·학습 수준 진단 결과 조회',
    description: '로그인한 사용자의 가장 최근 진단 결과를 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '진단 결과 조회 성공' })
  @ApiNotFoundResponse({
    description: '아직 진단을 완료하지 않은 사용자입니다.',
  })
  @ApiUnauthorizedResponse({ description: 'accessToken 없음 또는 만료' })
  getProfile(@Req() req) {
    return this.investmentProfileService.getProfile(req.user.userId);
  }
}
