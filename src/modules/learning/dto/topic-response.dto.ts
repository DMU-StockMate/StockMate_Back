import { ApiProperty } from '@nestjs/swagger';

export class TopicResponseDto {
  @ApiProperty({ example: 1, description: '카테고리(주제) ID' })
  topicId: number;

  @ApiProperty({ example: '투자 기초', description: '카테고리명' })
  topicName: string;

  @ApiProperty({
    example: '주식 투자 기본 개념',
    description: '카테고리 설명',
    nullable: true,
  })
  description: string | null;
}
