import { IsEnum } from 'class-validator';
import { UserStatus } from 'src/modules/enums/user-status.enum'; 

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}