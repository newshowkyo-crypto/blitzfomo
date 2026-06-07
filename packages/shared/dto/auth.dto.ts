// packages/shared/dto/auth.dto.ts

import { IsString, IsEthereumAddress } from 'class-validator';

export class GetNonceDto {
  @IsString()
  @IsEthereumAddress()
  address: string;
}

export class VerifySignatureDto {
  @IsString()
  @IsEthereumAddress()
  address: string;

  @IsString()
  signature: string;

  @IsString()
  nonce: string;
}

export class AuthResponse {
  token: string;
  user: {
    id: string;
    walletAddress: string;
    nickname?: string;
    balance: number;
  };
}