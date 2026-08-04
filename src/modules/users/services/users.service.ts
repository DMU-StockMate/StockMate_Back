import { InjectRedis } from '@nestjs-modules/ioredis';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { FileService } from 'src/modules/file/service/file.service';
import { Not, Repository } from 'typeorm';
import { EmailVerificationService } from '../../email/services/email-verification.service';

import * as bcrypt from 'bcryptjs';
import { UserRole } from 'src/modules/enums/role-enum';
import { CheckEmailDto } from '../dto/check-email.dto';
import { CheckNickNameDto } from '../dto/check-nickname.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRedis() private readonly redis: Redis, //redis 인스턴스 주입

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly jwtService: JwtService,

    private readonly emailService: EmailVerificationService,
    private readonly fileService: FileService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, nickname, role: _role, ...rest } = createUserDto;

    await this.emailService.checkEmailVerified(email, 'REGISTER');
    await this.checkEmail({ email });
    await this.checkNickName({ nickname });

    const hashed = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      password_hash: hashed,
      nickname,
      role: UserRole.USER,
      ...rest,
    });

    //생성 이후 이메일 인증 상태 지우는 코드
    const savedUser = await this.userRepository.save(user);

    await this.emailService.clearEmailVerified(email, 'REGISTER');

    return savedUser;
  }

  async findEmail(findEmailDto: {
    phone: string;
    name: string;
  }): Promise<{ email: string }> {
    const user = await this.userRepository.findOneBy({
      phone: findEmailDto.phone,
      name: findEmailDto.name,
    });
    if (!user) throw new NotFoundException('일치하는 회원이 없습니다.');
    return { email: user.email };
  }

  async resetPassword(resetPasswordDto: {
    email: string;
    newPassword: string;
  }): Promise<{ message: string }> {
    await this.emailService.checkEmailVerified(
      resetPasswordDto.email,
      'RESET_PASSWORD',
    );

    const user = await this.userRepository.findOneBy({
      email: resetPasswordDto.email,
    });

    if (!user) throw new NotFoundException('존재하지 않는 이메일입니다.');
    const hashed = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    await this.userRepository.update(user.user_id, { password_hash: hashed });

    //비밀번호 재설정 이후 이메일 인증 상태 지우는 코드
    await this.emailService.clearEmailVerified(
      resetPasswordDto.email,
      'RESET_PASSWORD',
    );
    return { message: '비밀번호가 성공적으로 변경되었습니다.' };
  }
  async changePassword(
    user_id: number,
    changePasswordDto: { currentPassword: string; newPassword: string },
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.userRepository.findOne({
      where: { user_id },
      select: ['user_id', 'password_hash'],
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('현재 비밀번호가 일치하지 않습니다.');
    }

    const isSame = await bcrypt.compare(newPassword, user.password_hash);
    if (isSame) {
      throw new BadRequestException(
        '새 비밀번호는 기존 비밀번호와 달라야 합니다.',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.userRepository.update(user_id, {
      password_hash: hashedPassword,
    });

    return { message: '비밀번호가 성공적으로 변경되었습니다.' };
  }
  //redis 달았고 리프레시 토큰 저장 때문에
  async login(
    loginUserDto: LoginUserDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { email, password } = loginUserDto;
    const user = await this.userRepository.findOne({
      where: { email },
      // selected:false 설정이라 password를 명시적으로 포함
      select: ['user_id', 'email', 'password_hash', 'role'],
    });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    //user status 추가하면서 ban 기능 구현
    if (user.status === 'BANNED') {
      throw new UnauthorizedException('정지된 계정입니다.');
    }

    if (user.status === 'DELETED') {
      throw new UnauthorizedException('탈퇴된 계정입니다.');
    }

    if (user.ban_until && new Date() < user.ban_until) {
      throw new UnauthorizedException('정지 기간입니다.');
    }

    const payload = { sub: user.user_id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    //await this.userRepository.update(user.userId, { refreshToken });
    await this.saveRefreshToken(user.user_id, refreshToken);

    return { accessToken, refreshToken };
  }

  async logout(user_id: number): Promise<{ message: string }> {
    await this.redis.del(`refresh_token:${user_id}`);
    return { message: '로그아웃 되었습니다.' };
  }

  //이게 그냥 유저한테 필요한가?
  // async findAll(): Promise<User[]> {
  //   return this.userRepository.find();
  // }

  async findOne(user_id: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ user_id });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
  }

  async update(user_id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const { name, nickname, phone } = updateUserDto;
    const updatePayload: Partial<Pick<User, 'name' | 'nickname' | 'phone'>> =
      {};

    if (name !== undefined) updatePayload.name = name;
    if (nickname !== undefined) updatePayload.nickname = nickname;
    if (phone !== undefined) updatePayload.phone = phone;

    if (Object.keys(updatePayload).length === 0) {
      throw new BadRequestException('수정할 회원 정보를 입력해주세요.');
    }

    if (updateUserDto.nickname) {
      const exist = await this.userRepository.findOne({
        where: { nickname: updateUserDto.nickname, user_id: Not(user_id) },
      });
      if (exist) throw new BadRequestException('이미 사용 중인 닉네임입니다.');
    }

    await this.userRepository.update(user_id, updatePayload);
    return this.findOne(user_id);
  }
  async checkEmail(checkEmailDto: CheckEmailDto): Promise<boolean> {
    const { email } = checkEmailDto;
    const user = await this.userRepository.findOne({ where: { email } });

    if (user) {
      throw new BadRequestException('이미 사용 중인 이메일입니다.');
    }
    return true; // 사용 가능할 경우
  }
  async checkNickName(checkNicknameDto: CheckNickNameDto): Promise<boolean> {
    const { nickname } = checkNicknameDto;
    const user = await this.userRepository.findOne({ where: { nickname } });

    if (user) {
      throw new BadRequestException('이미 사용 중인 닉네임입니다.');
    }
    return true;
  }
  // 이것도 따로 빼야하나 레디스 저장용
  private async saveRefreshToken(userId: number, refreshToken: string) {
    // key: refresh_token:1, value: 토큰값, EX: 7일(초 단위)
    const EXPIRE_TIME = 7 * 24 * 60 * 60;
    await this.redis.set(
      `refresh_token:${userId}`,
      refreshToken,
      'EX',
      EXPIRE_TIME,
    );
  }

  async updateProfileImage(
  userId: number,
  filename: string,
): Promise<{ message: string; profileImageUrl: string }> {
  const user = await this.findOne(userId);

  const profileImageUrl =
    await this.fileService.replaceProfileImage(
      user.profile_image_url,
      filename,
    );

  await this.userRepository.update(userId, {
    profile_image_url: profileImageUrl,
  });

  return {
    message: '프로필 이미지가 업로드되었습니다.',
    profileImageUrl,
  };
}

async deleteProfileImage(
  userId: number,
): Promise<{ message: string }> {
  const user = await this.findOne(userId);

  await this.fileService.deleteProfileImageByUrl(
    user.profile_image_url,
  );

  await this.userRepository.update(userId, {
    profile_image_url: null,
  });

  return {
    message: '프로필 이미지가 삭제되었습니다.',
  };
}

// 회원 탈퇴 기능 추가
}
