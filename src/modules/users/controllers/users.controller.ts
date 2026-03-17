import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { FindEmailDto } from '../dto/find-email.dto';

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


  @Post('login')
  @ApiOperation({ summary: '로그인' })
  @ApiBody({ type: LoginUserDto })
  @ApiResponse({ status: 200, description: '로그인 성공, JWT 토큰 반환' })
  async login(@Body() loginUserDto: LoginUserDto) {
    return await this.usersService.login(loginUserDto);
  }

  @Post('signup')
  @ApiOperation({ summary: '회원가입' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: '회원가입 성공' })
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



  @UseGuards(JwtAuthGuard)
  @Get(':userId')
  @ApiOperation({ summary: '회원 단일 조회' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 200, description: '회원 정보 반환' })
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
