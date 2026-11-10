import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule, ObserveInstrument } from './app.module.js';
import { UPLOAD_URL_PREFIX, uploadRoot } from './uploads/upload-paths.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
  });
  app.enableCors({
    origin: true,
    credentials: true,
  });
  // Ảnh gửi lên dạng base64 nên cần nâng giới hạn body (ảnh tối đa 5MB ~ 6.7MB base64).
  app.useBodyParser('json', { limit: '10mb' });
  // Phục vụ ảnh sản phẩm đã tải lên. Tên file là UUID ngẫu nhiên, không đoán được.
  app.useStaticAssets(uploadRoot(), {
    prefix: UPLOAD_URL_PREFIX,
    index: false,
    dotfiles: 'deny',
    maxAge: '7d',
  });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
