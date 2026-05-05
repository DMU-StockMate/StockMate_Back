


import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Not, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { User } from '../entities/user.entity';
import { CheckEmailDto } from '../dto/check-email.dto';
import { CheckNickNameDto } from '../dto/check-nickname.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRedis() private readonly redis: Redis, //redis 인스턴스 주입

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, nickname, ...rest } = createUserDto;

    await this.checkEmail({ email });
    await this.checkNickName({ nickname });

    const hashed = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({ email, password: hashed, nickname, ...rest });
    return this.userRepository.save(user);
  }

  async findEmail(findEmailDto: { phone: string; name: string }): Promise<{ email: string }> {
    const user = await this.userRepository.findOneBy({ phone: findEmailDto.phone, name: findEmailDto.name });
    if (!user) throw new NotFoundException('일치하는 회원이 없습니다.');
    return { email: user.email };
  }

  async resetPassword(resetPasswordDto: { email: string; newPassword: string }): Promise<{ message: string }> {
    const user = await this.userRepository.findOneBy({ email: resetPasswordDto.email });
    if (!user) throw new NotFoundException('존재하지 않는 이메일입니다.');
    const hashed = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    await this.userRepository.update(user.user_id, { password: hashed });
    return { message: '비밀번호가 성공적으로 변경되었습니다.' };
  }
  async changePassword(  user_id: number, changePasswordDto: { currentPassword: string; newPassword: string },): Promise<{ message: string }> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.userRepository.findOne({
      where: { user_id },
      select: ['user_id', 'password'],
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('현재 비밀번호가 일치하지 않습니다.');
    }

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      throw new BadRequestException('새 비밀번호는 기존 비밀번호와 달라야 합니다.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.userRepository.update(user_id, {
      password: hashedPassword,
    });

    return { message: '비밀번호가 성공적으로 변경되었습니다.' };
  }
  //redis 달아야겠고 리프레시 토큰 저장 때문에
  async login(loginUserDto: LoginUserDto): Promise<{ accessToken: string, refreshToken: string }> {
    const { email, password } = loginUserDto;
    const user = await this.userRepository.findOne({
      where: { email },
      // selected:false 설정이라 password를 명시적으로 포함
      select: ['user_id', 'email', 'password', 'role'],
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
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
  };


  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(user_id: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ user_id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(user_id: number, updateUserDto: UpdateUserDto): Promise<User> {
  
    if (updateUserDto.nickname) {
      const exist = await this.userRepository.findOne({ 
        where: { nickname: updateUserDto.nickname, user_id: Not(user_id) } 
      });
      if (exist) throw new BadRequestException('이미 사용 중인 닉네임입니다.');
    }
      
    await this.userRepository.update(user_id, updateUserDto);
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
      EXPIRE_TIME
    );
  }

  //해야할 거 
  // 이메일 발송 모듈, 엑세스 토큰 만료 시 리프레시 토큰과 대조 이후 재발급 서비스
  // 컨트롤러에서 :userId 로 사용자 정보 받고 있는 거 토큰에서 뽑는 방식으로 바꿔야 함, 회원 탈퇴 기능 추가
}
