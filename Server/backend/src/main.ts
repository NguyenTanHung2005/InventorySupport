import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { networkInterfaces } from 'node:os';
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

  const port = Number(process.env.PORT ?? 3000);
  // 0.0.0.0 để điện thoại / emulator trong cùng mạng truy cập được.
  await app.listen(port, '0.0.0.0');
  logReachableUrls(port);
}

/** In ra các địa chỉ mà mobile có thể dùng làm EXPO_PUBLIC_API_URL. */
function logReachableUrls(port: number) {
  const logger = new Logger('Bootstrap');
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => `http://${item!.address}:${port}`);
  logger.log(`Máy chủ sẵn sàng: http://localhost:${port}`);
  logger.log(`Android emulator: http://10.0.2.2:${port}`);
  for (const url of lan) logger.log(`Điện thoại cùng Wi-Fi: ${url}`);
}

await bootstrap();
