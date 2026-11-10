import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/request.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Body() dto: ChangePasswordDto, @Req() request: AuthenticatedRequest) {
    return this.authService.changePassword(request.user, dto);
  }
}
