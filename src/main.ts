import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './modules/users/users.service';
import * as bcrypt from 'bcrypt';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix
  app.setGlobalPrefix('api');

  // Trust Proxy (required for Google OAuth on Render/Proxies)
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);

  // Security Headers
  app.use(helmet());

  // Compression
  app.use(compression());

  // Enable validation pipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip non-whitelisted properties
      transform: true, // transform payload to DTO instances
      forbidNonWhitelisted: true, // throw an error if non-whitelisted properties are present
    }),
  );

  // Enable global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  const configService = app.get(ConfigService);
  let frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
  
  // Ensure we have a protocol for CORS origin matching
  if (frontendUrl && !frontendUrl.includes('://')) {
    frontendUrl = `https://${frontendUrl}`;
  }
  // Strip trailing slash
  frontendUrl = frontendUrl.replace(/\/$/, '');

  // Format origins to include both root and www variants
  const origins = [frontendUrl, 'http://localhost:3001'];
  if (frontendUrl && !frontendUrl.includes('localhost')) {
    try {
      const url = new URL(frontendUrl);
      const host = url.hostname;
      const protocol = url.protocol;
      if (host.startsWith('www.')) {
        origins.push(`${protocol}//${host.replace('www.', '')}`);
      } else {
        origins.push(`${protocol}//www.${host}`);
      }
    } catch (e) {
      console.warn('Invalid FRONTEND_URL for CORS:', frontendUrl);
    }
  }

  // Enable CORS
  app.enableCors({
    origin: origins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  const port = configService.get<number>('PORT', 3000);

  const usersService = app.get(UsersService);
  const defaultAdminPass = await bcrypt.hash('admin123', 10);
  await usersService.createInitialAdmin(defaultAdminPass);

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
}
bootstrap();
