// packages/shared/dto/admin.dto.ts
// Admin 相关 DTO

import { IsNumber, IsString, IsBoolean, IsOptional, Min } from 'class-validator';

export class AdjustBalanceDto {
  @IsNumber()
  amount: number; // 正数增加，负数减少（单位：元）

  @IsString()
  reason: string;
}

export class FreezeUserDto {
  @IsBoolean()
  freeze: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateBotConfigDto {
  @IsBoolean()
  botEnabled?: boolean;

  @IsNumber()
  @Min(1000)
  botPurchaseIntervalMs?: number;

  @IsNumber()
  botMinAmount?: number;

  @IsNumber()
  botMaxAmount?: number;
}