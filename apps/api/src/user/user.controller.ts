// apps/api/src/user/user.controller.ts
import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@CurrentUser() user: any) {
    return this.userService.getProfile(user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@CurrentUser() user: any, @Body() body: { nickname?: string }) {
    return this.userService.updateProfile(user.id, body);
  }

  @Get('profile/rich')
  @UseGuards(JwtAuthGuard)
  async richProfile(@CurrentUser() user: any) {
    return this.userService.getRichProfile(user.id);
  }
}