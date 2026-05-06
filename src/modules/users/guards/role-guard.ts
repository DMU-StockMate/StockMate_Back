import { CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from 'src/modules/enums/role-enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
            'roles',
            [
                context.getHandler(),
                context.getClass(),
            ],
    );

    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
        throw new UnauthorizedException('로그인이 필요합니다.');
    }

    if (!user.role) {
        throw new ForbiddenException('권한 정보가 없습니다.');
    }

    if (!requiredRoles.includes(user.role)) {
        throw new ForbiddenException('권한이 없습니다.');
    }

    return true;
  }
}