
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailVerificationModule } from '../email/email-verification.module';
import { FileModule } from '../file/module/file.module';
import { DEFAULT_JWT_SECRET } from './constants/jwt.constants';
import { AuthController } from './controllers/auth.controller';
import { UsersController } from './controllers/users.controller';
import { User } from './entities/user.entity';
import { UsersService } from './services/users.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') ?? DEFAULT_JWT_SECRET;

        return {
          secret,
          signOptions: { expiresIn: '1d' },
        };
      },
    }),
    EmailVerificationModule,
    FileModule,
  ],
  controllers: [UsersController, AuthController],
  providers: [UsersService, JwtStrategy],
  exports: [UsersService],
})
export class UsersModule {}
