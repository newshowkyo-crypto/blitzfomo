import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateGameConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  countdownSeconds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialPrizePool?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minBuyAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  winnerPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  platformPercent?: number;

  @IsOptional()
  @IsString()
  activePaymentGateway?: string;

  @IsOptional()
  @IsBoolean()
  botEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  botPurchaseIntervalMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  botMinAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  botMaxAmount?: number;
}

export class UpdateRiskConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  withdrawMinAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  withdrawMaxAmountDaily?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  withdrawRequirePurchaseCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  withdrawCooldownHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchaseMaxAmountPerTx?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  purchaseRateLimitPerMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  largeAmountThreshold?: number;
}
