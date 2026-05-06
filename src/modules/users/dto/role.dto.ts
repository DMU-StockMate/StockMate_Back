import { IsEnum } from 'class-validator';
import { UserRole } from 'src/modules/enums/role-enum'; 

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}