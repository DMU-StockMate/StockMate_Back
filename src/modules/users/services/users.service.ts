


import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, ...rest } = createUserDto;
    const exist = await this.userRepository.findOneBy({ email });
    if (exist) throw new BadRequestException('이미 등록된 이메일입니다.');
    const hashed = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({ email, password: hashed, ...rest });
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
    await this.userRepository.update(user.userId, { password: hashed });
    return { message: '비밀번호가 성공적으로 변경되었습니다.' };
  }
  async login(loginUserDto: LoginUserDto): Promise<{ accessToken: string }> {
    const { email, password } = loginUserDto;
    const user = await this.userRepository.findOne({ where: { email }, select: ['userId', 'email', 'password', 'name', 'role'] });
    if (!user) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    const payload = { sub: user.userId, email: user.email, role: user.role };
    return { accessToken: this.jwtService.sign(payload) };
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findOne(userId: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ userId });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(userId: number, updateUserDto: UpdateUserDto): Promise<User> {
    await this.userRepository.update(userId, updateUserDto);
    return this.findOne(userId);
  }
}
