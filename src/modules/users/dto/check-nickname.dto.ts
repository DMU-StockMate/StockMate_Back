import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// CreateUserDto에서 nickname 필드만 뽑아서 사용
export class CheckNickNameDto extends PickType(CreateUserDto, ['nickname'] as const) {}