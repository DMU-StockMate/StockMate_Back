import { Controller, Get, Post, Body, Param, Request, Patch, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiUnauthorizedResponse, ApiConflictResponse, ApiBadRequestResponse, ApiNotFoundResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { FindEmailDto } from '../dto/find-email.dto';
import { CheckNickNameDto } from '../dto/check-nickname.dto';
import { CheckEmailDto } from '../dto/check-email.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('find-email')
  @ApiOperation({ summary: '이메일 찾기' })
  @ApiBody({ type: FindEmailDto })
  @ApiResponse({ status: 200, description: '이메일 반환' })
  async findEmail(@Body() findEmailDto: FindEmailDto) {
    return await this.usersService.findEmail(findEmailDto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: '비밀번호 재설정' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: '비밀번호 재설정 성공' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.usersService.resetPassword(resetPasswordDto);
  }

  //이메일 중복 확인 (쿼리 파라미터 사용)
  @Get('check-email')
  @ApiOperation({ summary: '이메일 중복 체크' })
  @ApiResponse({ status: 200, description: '사용 가능 여부 반환' })
  async checkEmail(@Query('email') checkEmailDto: CheckEmailDto) {
    return await this.usersService.checkEmail(checkEmailDto);
  }

  //닉네임 중복 확인 (쿼리 파라미터 사용)
  @Get('check-nickname')
  @ApiOperation({ summary: '닉네임 중복 체크' })
  @ApiResponse({ status: 200, description: '사용 가능 여부 반환' })
  async checkNickname(@Query('nickname') checkNickNameDto: CheckNickNameDto) {
    return await this.usersService.checkNickName(checkNickNameDto);
  }

  //로그아웃 (Redis에서 Refresh Token 삭제)
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiOperation({ summary: '로그아웃' })
  @ApiResponse({ status: 200, description: '로그아웃 성공' })
  async logout(@Request() req) {
    return await this.usersService.logout(req.user.userId);
  }

  //비밀번호 변경 (로그인한 사용자용)
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  @ApiOperation({ summary: '로그인 상태에서 비밀번호 변경' })
  @ApiResponse({ status: 200, description: '비밀번호 변경 성공' })
  async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
    return await this.usersService.changePassword(req.user.userId, changePasswordDto);
  }


  @Post('login')
  @ApiOperation({ summary: '로그인' })
  @ApiBody({ type: LoginUserDto })
  @ApiResponse({ status: 200, description: '로그인 성공, JWT 토큰 반환' })
  @ApiUnauthorizedResponse({ description: '이메일 또는 비밀번호가 올바르지 않습니다.' })
  async login(@Body() loginUserDto: LoginUserDto) {
    return await this.usersService.login(loginUserDto);
  }

  @Post('signup')
  @ApiOperation({ summary: '회원가입' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: '회원가입 성공' })
  @ApiBadRequestResponse({ description: '입력값이 올바르지 않습니다.' })
  @ApiConflictResponse({ description: '이미 등록된 이메일 또는 닉네임입니다.' })
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.create(createUserDto);
  }


  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: '전체 회원 조회' })
  @ApiResponse({ status: 200, description: '회원 목록 반환' })
  async findAll() {
    return await this.usersService.findAll();
  }


  //파람이 아니고 express req로 토큰 받아서 써야함
  @UseGuards(JwtAuthGuard)
  @Get(':userId')
  @ApiOperation({ summary: '회원 단일 조회' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 200, description: '회원 정보 반환' })
  @ApiNotFoundResponse({ description: '존재하지 않는 회원입니다.' }) 
  @ApiUnauthorizedResponse({ description: '인증 정보가 유효하지 않습니다.' })
  async findOne(@Param('userId') userId: string) {
    return await this.usersService.findOne(Number(userId));
  }



  @UseGuards(JwtAuthGuard)
  @Patch(':userId')
  @ApiOperation({ summary: '회원 정보 수정' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: '회원 정보 수정 성공' })
  async update(@Param('userId') userId: string, @Body() updateUserDto: UpdateUserDto) {
    return await this.usersService.update(Number(userId), updateUserDto);
  }
}
