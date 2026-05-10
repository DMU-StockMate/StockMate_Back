export class QuestionResponseDto {
  questionId: number;
  questionText: string;
  choices: {
    id: number;
    text: string;
  }[];
}