// packages/shared/dto/withdraw.dto.ts

import { IsNumber, IsString, IsEnum, Min, MaxLength, Matches } from 'class-validator';

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
  @MaxLength(256)
  @Matches(/^[a-zA-Z0-9_.:-]+$/, { message: 'Invalid wallet address format' })
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