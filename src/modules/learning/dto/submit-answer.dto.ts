import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({
    example: 3,
    description: '사용자가 선택한 보기 ID',
  })
  @IsNotEmpty({ message: '선택한 보기 ID는 필수입니다.' })
  @IsInt({ message: '선택한 보기 ID는 정수여야 합니다.' })
  @Min(1, { message: '선택한 보기 ID는 1 이상이어야 합니다.' })
  selectedChoiceId: number;
}