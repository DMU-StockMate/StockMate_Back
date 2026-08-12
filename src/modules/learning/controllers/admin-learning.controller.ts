import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '../../enums/role-enum';
import { Roles } from '../../users/decorators/role-decorator';
import { JwtAuthGuard } from '../../users/guards/jwt-auth.guard';
import { RolesGuard } from '../../users/guards/role-guard';
import { QualityCandidatesQueryDto } from '../dto/quality-candidates-query.dto';
import { UpdateQuestionReviewStatusDto } from '../dto/update-question-review-status.dto';
import { LearningQualityService } from '../services/learning-quality.service';

@ApiTags('Admin Learning Quality')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/learning')
export class AdminLearningController {
  constructor(private readonly learningQualityService: LearningQualityService) {}

  @Get('questions/quality-summary')
  @ApiOperation({ summary: '문제 품질 요약 조회' })
  getQualitySummary() {
    return this.learningQualityService.getQualitySummary();
  }

  @Get('questions/quality-candidates')
  @ApiOperation({ summary: '품질 점검 대상 문제 조회' })
  getQualityCandidates(@Query() query: QualityCandidatesQueryDto) {
    return this.learningQualityService.getQualityCandidates(query);
  }

  @Get('question-quality/details/:detailId/replacement-candidates')
  @ApiOperation({ summary: '세부 개념별 ACTIVE 50문제 유지 후보 조회' })
  getReplacementCandidates(@Param('detailId') detailId: string) {
    return this.learningQualityService.getReplacementCandidates(Number(detailId));
  }

  @Patch('questions/:questionId/review-status')
  @ApiOperation({ summary: '관리자 문제 검수 상태 변경' })
  updateReviewStatus(
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionReviewStatusDto,
  ) {
    return this.learningQualityService.updateReviewStatus(Number(questionId), dto);
  }

  @Patch('questions/:questionId/recalculate-quality')
  @ApiOperation({ summary: '문제 최종 품질 점수 재계산' })
  recalculateQuality(@Param('questionId') questionId: string) {
    return this.learningQualityService.recalculateQuality(Number(questionId));
  }
}
