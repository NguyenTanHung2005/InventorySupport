import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Mobile gọi để kiểm tra kết nối tới máy chủ (màn đăng nhập). */
  @Get('health')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
