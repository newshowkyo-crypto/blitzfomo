// packages/shared/dto/game.dto.ts
// 游戏相关 DTO（前后端共享）

import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PurchaseDto {
  @IsNumber()
  @Min(1)
  amount: number; // 前端传 BF 面值（服务端转 bigint 最小单位）

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class GameStateResponse {
  roundId: string;
  roundNumber: number;
  prizePool: number;        // 已换算为 BF/美元面值（服务端已 /100）
  countdown: number;        // 剩余秒数
  lastBuyer: string | null;
  minBuy: number;
  winnerPercent: number;
  platformPercent: number;
  gameActive: boolean;
  activeFans?: number;
  totalWithdrawn?: number;
  tournamentMapUrl?: string | null; // 后台可配置赛事地图图片 URL（空则前台用本地默认图）
}

export class RecentPurchaseItem {
  id: string;
  userNickname: string;
  amount: number;
  createdAt: string;
  isBot: boolean;
}

export class WinnerWallItem {
  nickname: string;
  amount: number; // 中奖金额（70%）
  roundNumber: number;
  wonAt: string;
}