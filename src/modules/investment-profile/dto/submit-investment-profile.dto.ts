import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PROFILE_QUESTION_SCORING } from '../constants/investment-profile-scoring';

export class InvestmentProfileAnswerDto {
  @ApiProperty({ example: 'LOSS_TOLERANCE', description: '문항 코드' })
  @IsString()
  @IsNotEmpty({ message: 'questionCode는 필수입니다.' })
  questionCode: string;

  @ApiProperty({ example: 'LOSS_20_PERCENT', description: '선택한 보기 코드' })
  @IsString()
  @IsNotEmpty({ message: 'optionCode는 필수입니다.' })
  optionCode: string;
}

const QUESTION_COUNT = PROFILE_QUESTION_SCORING.length;

export class SubmitInvestmentProfileDto {
  @ApiProperty({ type: [InvestmentProfileAnswerDto] })
  @IsArray()
  @ArrayMinSize(QUESTION_COUNT, {
    message: `answers는 ${QUESTION_COUNT}개여야 합니다.`,
  })
  @ArrayMaxSize(QUESTION_COUNT, {
    message: `answers는 ${QUESTION_COUNT}개여야 합니다.`,
  })
  @ValidateNested({ each: true })
  @Type(() => InvestmentProfileAnswerDto)
  answers: InvestmentProfileAnswerDto[];
}
