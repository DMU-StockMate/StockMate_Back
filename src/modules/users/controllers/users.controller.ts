import { BadRequestException, Body, Controller, Delete, Get, Patch, Post, Query, Req, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConsumes, ApiInternalServerErrorResponse, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { CheckEmailDto } from '../dto/check-email.dto';
import { CheckNickNameDto } from '../dto/check-nickname.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { FindEmailDto } from '../dto/find-email.dto';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { WithdrawDto } from '../dto/withdraw.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UsersService } from '../services/users.service';

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
  @ApiNotFoundResponse({
  description: '사용자를 찾을 수 없습니다.',
  })
  @ApiUnauthorizedResponse({
    description: '현재 비밀번호가 일치하지 않습니다.',
  })
  @ApiBadRequestResponse({
    description: '새 비밀번호는 기존 비밀번호와 달라야 합니다.',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.usersService.resetPassword(resetPasswordDto);
  }

  //이메일 중복 확인 (쿼리 파라미터 사용)
  @Get('check-email')
  @ApiOperation({ summary: '이메일 중복 체크' })
  @ApiResponse({ status: 200, description: '사용 가능 여부 반환' })
  async checkEmail(@Query() checkEmailDto: CheckEmailDto) {
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
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return await this.usersService.changePassword(
      req.user.userId,
      changePasswordDto,
    );
  }

  @Post('login')
  @ApiOperation({ summary: '로그인' })
  @ApiBody({ type: LoginUserDto })
  @ApiResponse({ status: 200, description: '로그인 성공, JWT 토큰 반환' })
  @ApiUnauthorizedResponse({
    description: '이메일 또는 비밀번호가 올바르지 않습니다.',
  })
  async login(@Body() loginUserDto: LoginUserDto) {
    return await this.usersService.login(loginUserDto);
  }

  @Post('google-login')
  @ApiOperation({ summary: '구글 로그인' })
  @ApiBody({ type: GoogleLoginDto })
  @ApiResponse({ status: 200, description: '구글 로그인 성공, JWT 토큰 반환' })
  async googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
    return await this.usersService.googleLogin(googleLoginDto.idToken);
  }

  @Post('signup')
  @ApiOperation({ summary: '회원가입' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: '회원가입 성공' })@ApiBadRequestResponse({
    description: `
  - 입력값이 올바르지 않습니다.
  - 이메일 인증이 필요합니다.
  - 이미 사용 중인 이메일입니다.
  - 이미 사용 중인 닉네임입니다.
    `,
  })
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.create(createUserDto);
  }

  // @UseGuards(JwtAuthGuard)
  // @Get()
  // @ApiOperation({ summary: '전체 회원 조회' })
  // @ApiResponse({ status: 200, description: '회원 목록 반환' })
  // async findAll() {
  //   return await this.usersService.findAll();
  // }

  //파람이 아니고 express req로 토큰 받아서 써야함
  //수정했음
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: '내 정보 조회' })
  async findMe(@Request() req) {
    return await this.usersService.findOne(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @Patch()
  @ApiOperation({ summary: '회원 정보 수정 (본인)' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: '회원 정보 수정 성공' })
  async updateCurrentUser(
    @Request() req,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.usersService.update(req.user.userId, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @Delete()
  @ApiOperation({ summary: '회원 탈퇴 (본인)' })
  @ApiBody({ type: WithdrawDto })
  @ApiResponse({ status: 200, description: '회원 탈퇴 성공' })
  @ApiUnauthorizedResponse({ description: '비밀번호가 일치하지 않습니다.' })
  async withdraw(@Request() req, @Body() withdrawDto: WithdrawDto) {
    return await this.usersService.withdraw(req.user.userId, withdrawDto);
  }

@Post('me/profile-image')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('accessToken')
@UseInterceptors(
  FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/profile',
      filename: (req, file, callback) => {
        const uniqueName = `${uuidv4()}${extname(
          file.originalname,
        )}`;

        callback(null, uniqueName);
      },
    }),
    fileFilter: (req, file, callback) => {
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
      ];

      if (!allowedTypes.includes(file.mimetype)) {
        return callback(
          new BadRequestException(
            'jpg, png, webp 이미지만 업로드할 수 있습니다.',
          ),
          false,
        );
      }

      callback(null, true);
    },
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  }),
)
@ApiOperation({
  summary: '프로필 이미지 업로드',
  description:
    '로그인한 사용자의 프로필 이미지를 업로드하고 기존 이미지를 교체합니다.',
})
@ApiConsumes('multipart/form-data')
@ApiBody({
  description: '프로필 이미지 파일',
  schema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        format: 'binary',
      },
    },
  },
})
@ApiResponse({
  status: 201,
  description: '프로필 이미지 업로드 성공',
})
@ApiBadRequestResponse({
  description: `
- 파일이 첨부되지 않았습니다.
- jpg, png, webp 이미지만 업로드할 수 있습니다.
- 파일 크기는 최대 5MB까지 가능합니다.
  `,
})
@ApiUnauthorizedResponse({
  description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
  `,
})
@ApiInternalServerErrorResponse({
  description: '서버 내부 오류',
})
uploadProfileImage(
  @Req() req,
  @UploadedFile() file: any,
) {
  if (!file) {
    throw new BadRequestException(
      '파일이 첨부되지 않았습니다.',
    );
  }

  return this.usersService.updateProfileImage(
    req.user.userId,
    file.filename,
  );
}

@Delete('me/profile-image')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('accessToken')
@ApiOperation({
  summary: '프로필 이미지 삭제',
  description:
    '로그인한 사용자의 프로필 이미지를 삭제하고 DB의 profile_image_url을 초기화합니다.',
})
@ApiResponse({
  status: 200,
  description: '프로필 이미지 삭제 성공',
})
@ApiUnauthorizedResponse({
  description: `
- accessToken 없음
- accessToken 만료
- 잘못된 토큰
  `,
})
@ApiInternalServerErrorResponse({
  description: '서버 내부 오류',
})
deleteProfileImage(@Req() req) {
  return this.usersService.deleteProfileImage(
    req.user.userId,
  );
}
}
