import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { NestExpressApplication } from '@nestjs/platform-express';

import { join } from 'path';

import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app =
    await NestFactory.create<NestExpressApplication>(
      AppModule,
    );

  app.enableCors({
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
    credentials: true,
  });

  // 업로드 폴더 자동 생성
  const uploadPath = join(
    process.cwd(),
    'uploads',
    'profile',
  );

  if (!existsSync(uploadPath)) {
    mkdirSync(uploadPath, {
      recursive: true,
    });
  }

  // 정적 파일 제공
  app.useStaticAssets(
    join(process.cwd(), 'uploads'),
    {
      prefix: '/uploads',
    },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use((req, _res, next) => {
    if (req.url.startsWith('/api/')) {
      req.url = req.url.slice(4);
    }

    next();
  });

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('Stock Mate API')
    .setDescription('Stock Mate API 문서')
    .setVersion('1.0')
    .addTag('users')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'JWT 토큰을 입력하세요',
        in: 'header',
      },
      'accessToken',
    )
    .build();

  const document =
    SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document);

  await app.listen(3000);

  console.log('MAIL_HOST:', process.env.MAIL_HOST);
console.log('MAIL_USER:', process.env.MAIL_USER);
console.log('MAIL_PASS exists:', !!process.env.MAIL_PASS);
}

bootstrap();
