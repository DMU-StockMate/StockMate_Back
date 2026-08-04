import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvestmentProfile } from '../entities/investment-profile.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { SubmitInvestmentProfileDto } from '../dto/submit-investment-profile.dto';
import {
  CURRENT_PROFILE_VERSION,
  PROFILE_QUESTION_SCORING,
  getCategoryRange,
  normalizeScore,
  recommendedLevelSlugById,
  resolveRecommendedLevel,
  resolveRiskType,
} from '../constants/investment-profile-scoring';

@Injectable()
export class InvestmentProfileService {
  constructor(
    @InjectRepository(InvestmentProfile)
    private readonly profileRepository: Repository<InvestmentProfile>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async submit(userId: number, dto: SubmitInvestmentProfileDto) {
    const answerByQuestion = new Map(
      dto.answers.map((answer) => [answer.questionCode, answer.optionCode]),
    );

    if (answerByQuestion.size !== dto.answers.length) {
      throw new BadRequestException('동일한 문항에 중복 응답했습니다.');
    }

    let riskRaw = 0;
    let knowledgeRaw = 0;

    for (const question of PROFILE_QUESTION_SCORING) {
      const optionCode = answerByQuestion.get(question.questionCode);
      if (!optionCode) {
        throw new BadRequestException(
          `${question.questionCode} 문항에 대한 답변이 없습니다.`,
        );
      }

      const option = question.options.find((o) => o.optionCode === optionCode);
      if (!option) {
        throw new BadRequestException(
          `${question.questionCode} 문항에 존재하지 않는 선택지입니다.`,
        );
      }

      if (question.category === 'RISK') riskRaw += option.points;
      else knowledgeRaw += option.points;
    }

    const riskRange = getCategoryRange('RISK');
    const knowledgeRange = getCategoryRange('KNOWLEDGE');
    const riskScore = normalizeScore(riskRaw, riskRange.min, riskRange.max);
    const knowledgeScore = normalizeScore(
      knowledgeRaw,
      knowledgeRange.min,
      knowledgeRange.max,
    );
    const riskType = resolveRiskType(riskScore);
    const recommendedLevel = resolveRecommendedLevel(knowledgeScore);
    const diagnosedAt = new Date();

    await this.profileRepository.upsert(
      {
        user_id: userId,
        risk_score: riskScore,
        risk_type: riskType,
        knowledge_score: knowledgeScore,
        recommended_level_id: recommendedLevel.levelId,
        answers: dto.answers,
        profile_version: CURRENT_PROFILE_VERSION,
        diagnosed_at: diagnosedAt,
      },
      ['user_id'],
    );

    await this.userRepository.update(userId, {
      investment_level_id: recommendedLevel.levelId,
    });

    return this.formatResponse({
      risk_score: riskScore,
      risk_type: riskType,
      knowledge_score: knowledgeScore,
      recommended_level_id: recommendedLevel.levelId,
      diagnosed_at: diagnosedAt,
      profile_version: CURRENT_PROFILE_VERSION,
    });
  }

  async getProfile(userId: number) {
    const profile = await this.profileRepository.findOneBy({ user_id: userId });
    if (!profile) {
      throw new NotFoundException(
        '아직 투자성향 및 학습 수준 진단을 완료하지 않았습니다.',
      );
    }
    return this.formatResponse(profile);
  }

  private formatResponse(
    profile: Pick<
      InvestmentProfile,
      | 'risk_score'
      | 'risk_type'
      | 'knowledge_score'
      | 'recommended_level_id'
      | 'diagnosed_at'
      | 'profile_version'
    >,
  ) {
    return {
      riskProfile: {
        score: profile.risk_score,
        type: profile.risk_type,
      },
      learningProfile: {
        score: profile.knowledge_score,
        recommendedLevelId: profile.recommended_level_id,
        recommendedLevel: recommendedLevelSlugById(
          profile.recommended_level_id,
        ),
      },
      diagnosedAt: profile.diagnosed_at,
      profileVersion: profile.profile_version,
    };
  }
}
