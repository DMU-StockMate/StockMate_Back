import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let userId: number;
  let testEmail: string;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    testEmail = `e2euser_${Date.now()}@example.com`;

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /users/signup - 회원가입', async () => {
    const res = await request(app.getHttpServer())
      .post('/users/signup')
      .send({
        email: testEmail,
        password: 'test1234',
        name: 'E2E Tester',
        phone: '010-1234-5678',
      })
      .expect(201);

    expect(res.body).toHaveProperty('userId');
    userId = Number(res.body.userId);

    // 로그인하여 accessToken 획득
    const loginRes = await request(app.getHttpServer())
      .post('/users/login')
      .send({ email: testEmail, password: 'test1234' })
      .expect(201);
    expect(loginRes.body).toHaveProperty('accessToken');
    accessToken = loginRes.body.accessToken;
  });

  it('GET /users - 전체 회원 조회', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /users/:id - 단일 회원 조회', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('userId');
    expect(Number(res.body.userId)).toBe(userId);
  });

  it('PATCH /users/:id - 회원 정보 수정', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/users/${userId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'E2E Tester Updated' })
      .expect(200);

    expect(res.body).toHaveProperty('name', 'E2E Tester Updated');
  });
});