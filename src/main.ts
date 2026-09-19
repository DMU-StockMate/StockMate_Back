import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import { AppModule } from './app.module';

async function bootstrap() {
  const app =
    await NestFactory.create<NestExpressApplication>(
      AppModule,
    );

  const frontendOrigins = (process.env.FRONTEND_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      ...frontendOrigins,
    ],
    credentials: true,
  });

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
        description: 'JWT 토큰을 입력하세요.',
        in: 'header',
      },
      'accessToken',
    )
    .build();

  const document =
    SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document);

  app.use((req, _res, next) => {
    if (req.url.startsWith('/api/')) {
      req.url = req.url.slice(4);
    }

    next();
  });

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);

  console.log('MAIL_HOST:', process.env.MAIL_HOST);
  console.log('MAIL_USER:', process.env.MAIL_USER);
  console.log('MAIL_PASS exists:', !!process.env.MAIL_PASS);
}

bootstrap();
