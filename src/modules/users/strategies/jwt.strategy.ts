import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { UserStatus } from 'src/modules/enums/user-status.enum';
import { DEFAULT_JWT_SECRET } from '../constants/jwt.constants';
import { User } from '../entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    const secret =
      configService.get<string>('JWT_SECRET') ?? DEFAULT_JWT_SECRET;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // 추후 수정 필!
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const user = await this.userRepository.findOne({ where: { user_id: payload.sub } });

    if (!user || user.status === UserStatus.DELETED) {
      throw new UnauthorizedException('탈퇴된 계정입니다.');
    }
    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('정지된 계정입니다.');
    }
    if (user.ban_until && new Date() < user.ban_until) {
      throw new UnauthorizedException('정지 기간입니다.');
    }

    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
