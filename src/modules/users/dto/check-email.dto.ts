import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// CreateUserDto에서 email 필드만 뽑아서 사용
export class CheckEmailDto extends PickType(CreateUserDto, ['email'] as const) {}