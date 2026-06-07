// packages/shared/dto/withdraw.dto.ts

import { IsNumber, IsString, IsEnum, Min } from 'class-validator';

export enum ChainType {
  TON = 'TON',
  TRC20 = 'TRC20',
  ERC20 = 'ERC20',
}

export class CreateWithdrawDto {
  @IsNumber()
  @Min(10)
  amountUsdt: number; // USDT 面值（服务端 *100 转 bigint）

  @IsString()
  toAddress: string;

  @IsEnum(ChainType)
  chain: ChainType;
}

export class WithdrawResponse {
  withdrawId: string;
  status: string;
  amountUsdt: number;
  riskScore: number;
  message?: string;
}