import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Issue #589 — POST /api/v1/auth/login */
  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password);
  }

  /** Issue #590 — POST /api/v1/auth/refresh */
  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  /** Issue #592 — GET /api/v1/auth/verify-email?token=xxx */
  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  /** Issue #592 — POST /api/v1/auth/resend-verification */
  @Post('resend-verification')
  resendVerification(@Body() body: { email: string }) {
    return this.auth.resendVerification(body.email);
  }
}
