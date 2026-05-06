import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { User } from '../entities/user.entity';
import { UserRole } from 'src/modules/enums/role-enum';
import { UserStatus } from 'src/modules/enums/user-status.enum';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRedis()
    private readonly redis: Redis,

  ) {}

    //전체 유저 조회
    async findAllUsers(): Promise<User[]> {
    return this.userRepository.find();
    }

    // 아이디 값으로 유저 조회
    async findUserById(user_id: number): Promise<User> {
        

        return await this.validateUser(user_id);
    }

    // 상태 변경처리로 탈퇴처리 할거니까 상태 변경으로 합치는게 맞지않나?
    // async deleteUser(user_id: number): Promise<{ message: string }> {
    // const user = await this.findUserById(user_id);

    // await this.userRepository.delete(user_id);
    // await this.redis.del(`refresh_token:${user_id}`);

    // return { message: '사용자가 삭제되었습니다.' };
    // }

    // 권한 변경
    async updateUserRole(user_id: number, role: UserRole): Promise<User> {
        const user = await this.validateUser(user_id);

        user.role = role;
        return this.userRepository.save(user);
    }

    // 상태 변경
    async updateUserStatus(user_id: number, status: UserStatus): Promise<User> {
        await this.validateUser(user_id);

        await this.userRepository.update(user_id, { status });

        if (status === UserStatus.BANNED || status === UserStatus.DELETED){
            await this.redis.del(`refresh_token:${user_id}`);
        }

        return this.findUserById(user_id);
    }

    //중복 코드 
    private async validateUser(user_id: number): Promise<User> {
        const user = await this.userRepository.findOneBy({ user_id });

        if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

        return user;
    }
}