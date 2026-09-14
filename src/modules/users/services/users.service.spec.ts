import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserRole } from 'src/modules/enums/role-enum';
import { UserStatus } from 'src/modules/enums/user-status.enum';
import { UserAuthProvider } from '../entities/user.entity';
import { UsersService } from './users.service';

const makeService = () => {
  const redis = { set: jest.fn(), del: jest.fn() };
  const repo = {
    create: jest.fn((user) => user),
    save: jest.fn(async (user) => ({ user_id: user.user_id ?? 1, ...user })),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
  };
  const jwt = { sign: jest.fn(() => 'token') };
  const email = {
    checkEmailVerified: jest.fn(),
    clearEmailVerified: jest.fn(),
  };
  const file = {};

  return {
    service: new UsersService(
      redis as any,
      repo as any,
      jwt as any,
      email as any,
      file as any,
    ),
    redis,
    repo,
    jwt,
    email,
  };
};

describe('UsersService auth account reuse', () => {
  it('rejects password login for deleted users', async () => {
    const { service, repo } = makeService();
    repo.findOne.mockResolvedValue({
      user_id: 1,
      email: 'user@example.com',
      password_hash: await bcrypt.hash('Password1', 1),
      role: UserRole.USER,
      status: UserStatus.DELETED,
      ban_until: null,
      auth_provider: UserAuthProvider.LOCAL,
    });

    await expect(
      service.login({ email: 'user@example.com', password: 'Password1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('reuses a legacy deleted email with the new signup data', async () => {
    const { service, repo } = makeService();
    repo.findOne
      .mockResolvedValueOnce({
        user_id: 7,
        email: 'user@example.com',
        status: UserStatus.DELETED,
        auth_provider: UserAuthProvider.LOCAL,
      })
      .mockResolvedValueOnce(null);

    const user = await service.create({
      email: 'user@example.com',
      password: 'Password1',
      name: 'New Name',
      nickname: '새닉네임',
      phone: '010-9999-8888',
    });

    expect(user.user_id).toBe(7);
    expect(user.nickname).toBe('새닉네임');
    expect(user.phone).toBe('010-9999-8888');
    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(user.auth_provider).toBe(UserAuthProvider.LOCAL);
  });

  it('clears stale profile fields when a deleted Google user signs in again', async () => {
    const { service, repo } = makeService();
    (service as any).verifyGoogleIdToken = jest.fn().mockResolvedValue({
      email: 'google@example.com',
      name: 'Google User',
      picture: 'https://example.com/profile.png',
    });
    repo.findOne
      .mockResolvedValueOnce({
        user_id: 9,
        email: 'google@example.com',
        nickname: 'oldnick',
        phone: '010-1111-2222',
        status: UserStatus.DELETED,
        auth_provider: UserAuthProvider.GOOGLE,
      })
      .mockResolvedValueOnce(null);
    repo.findOneBy.mockResolvedValue({
      user_id: 9,
      email: 'google@example.com',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      ban_until: null,
      auth_provider: UserAuthProvider.GOOGLE,
    });

    await service.googleLogin('id-token');

    expect(repo.update).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        name: 'Google User',
        nickname: 'google',
        phone: '',
        auth_provider: UserAuthProvider.GOOGLE,
        status: UserStatus.ACTIVE,
      }),
    );
  });

  it('links Google login to an existing local account without creating a user', async () => {
    const { service, repo } = makeService();
    (service as any).verifyGoogleIdToken = jest.fn().mockResolvedValue({
      email: 'user@example.com',
      name: 'Google User',
      picture: 'https://example.com/profile.png',
    });
    repo.findOne.mockResolvedValue({
      user_id: 3,
      email: 'user@example.com',
      nickname: 'localnick',
      phone: '010-1234-5678',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      auth_provider: UserAuthProvider.LOCAL,
      profile_image_url: null,
      ban_until: null,
    });

    await service.googleLogin('id-token');

    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ auth_provider: UserAuthProvider.BOTH }),
    );
  });

  it('uses the user created by a concurrent Google login on duplicate email', async () => {
    const { service, repo } = makeService();
    (service as any).verifyGoogleIdToken = jest.fn().mockResolvedValue({
      email: 'race@example.com',
      name: 'Google User',
    });
    repo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        user_id: 11,
        email: 'race@example.com',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        auth_provider: UserAuthProvider.GOOGLE,
        ban_until: null,
      });
    repo.save.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

    await service.googleLogin('id-token');

    expect(repo.findOne).toHaveBeenLastCalledWith({
      where: { email: 'race@example.com' },
    });
  });

  it('links local signup to an existing Google account without overwriting profile fields', async () => {
    const { service, repo } = makeService();
    repo.findOne.mockResolvedValueOnce({
      user_id: 4,
      email: 'user@example.com',
      name: 'Google Name',
      nickname: 'googlenick',
      phone: '010-1111-2222',
      status: UserStatus.ACTIVE,
      auth_provider: UserAuthProvider.GOOGLE,
      investment_level_id: 2,
      profile_image_url: 'profile.png',
    });

    const user = await service.create({
      email: ' User@Example.com ',
      password: 'Password1',
      name: 'Signup Name',
      nickname: 'signupnick',
      phone: '010-9999-8888',
    });

    expect(user.user_id).toBe(4);
    expect(user.email).toBe('user@example.com');
    expect(user.nickname).toBe('googlenick');
    expect(user.phone).toBe('010-1111-2222');
    expect(user.auth_provider).toBe(UserAuthProvider.BOTH);
  });

  it('rejects local signup for an existing local or linked email', async () => {
    const { service, repo } = makeService();
    repo.findOne.mockResolvedValue({
      user_id: 5,
      email: 'user@example.com',
      status: UserStatus.ACTIVE,
      auth_provider: UserAuthProvider.BOTH,
    });

    await expect(
      service.create({
        email: 'USER@example.com',
        password: 'Password1',
        name: 'Name',
        nickname: 'nick',
        phone: '010-9999-8888',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks banned users from Google login too', async () => {
    const { service, repo } = makeService();
    (service as any).verifyGoogleIdToken = jest.fn().mockResolvedValue({
      email: 'user@example.com',
      name: 'Google User',
    });
    repo.findOne.mockResolvedValue({
      user_id: 6,
      email: 'user@example.com',
      role: UserRole.USER,
      status: UserStatus.BANNED,
      auth_provider: UserAuthProvider.GOOGLE,
      ban_until: null,
    });

    await expect(service.googleLogin('id-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
