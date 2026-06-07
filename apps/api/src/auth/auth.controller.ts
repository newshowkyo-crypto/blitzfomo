// apps/api/src/auth/auth.controller.ts
import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { GetNonceDto, VerifySignatureDto } from '@blitz/shared/dto/auth.dto';

class TelegramAuthDto {
  @IsString()
  initData: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('nonce')
  async getNonce(@Query() dto: GetNonceDto) {
    return this.authService.getNonce(dto.address);
  }

  // 本地开发 fallback：伪签名登录。生产环境请改用 POST /api/auth/telegram。
  @Post('verify')
  async verify(@Body() dto: VerifySignatureDto) {
    return this.authService.verifySignature(dto.address, dto.signature, dto.nonce);
  }

  // 生产推荐：校验 Telegram WebApp initData（使用 BOT_TOKEN 验签）
  @Post('telegram')
  async telegram(@Body() dto: TelegramAuthDto) {
    return this.authService.verifyTelegramInitData(dto.initData);
  }
}