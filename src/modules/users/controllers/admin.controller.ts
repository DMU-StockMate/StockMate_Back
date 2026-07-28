import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminService } from '../services/admin.service';
import { Roles } from '../decorators/role-decorator';
import { RolesGuard } from '../guards/role-guard';
import { UserRole } from 'src/modules/enums/role-enum';
import { UpdateUserRoleDto } from '../dto/role.dto';
import { UpdateUserStatusDto } from '../dto/status.dto';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

@ApiTags('admin-users')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/users')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // 전체 조회
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '전체 사용자 조회 (관리자)' })
  @ApiResponse({ status: 200, description: '사용자 목록 반환 성공' })
  @ApiForbiddenResponse({ description: '관리자 권한이 없습니다.' })
  findAll() {
    return this.adminService.findAllUsers();
  }

  // 단일 조회
  @Get(':userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '특정 사용자 조회 (관리자)' })
  @ApiParam({ name: 'userId', type: Number, description: '조회할 사용자 ID' })
  @ApiResponse({ status: 200, description: '사용자 조회 성공' })
  @ApiNotFoundResponse({ description: '사용자를 찾을 수 없습니다.' })
  @ApiForbiddenResponse({ description: '관리자 권한이 없습니다.' })
  findOne(@Param('userId') userId: string) {
    return this.adminService.findUserById(Number(userId));
  }

  // 권한 변경
  @Patch(':userId/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '사용자 권한 변경 (관리자)' })
  @ApiParam({ name: 'userId', type: Number, description: '대상 사용자 ID' })
  @ApiResponse({ status: 200, description: '권한 변경 성공' })
  @ApiBadRequestResponse({ description: '잘못된 role 값입니다.' })
  @ApiNotFoundResponse({ description: '사용자를 찾을 수 없습니다.' })
  @ApiForbiddenResponse({ description: '관리자 권한이 없습니다.' })
  updateRole(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(Number(userId), dto.role);
  }

  // 상태 변경
  @Patch(':userId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '사용자 상태 변경 (정지/탈퇴 등)' })
  @ApiParam({ name: 'userId', type: Number, description: '대상 사용자 ID' })
  @ApiResponse({ status: 200, description: '상태 변경 성공' })
  @ApiBadRequestResponse({ description: '잘못된 status 값입니다.' })
  @ApiNotFoundResponse({ description: '사용자를 찾을 수 없습니다.' })
  @ApiForbiddenResponse({ description: '관리자 권한이 없습니다.' })
  updateStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(Number(userId), dto.status);
  }
}