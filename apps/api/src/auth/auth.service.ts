import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {}

  private assertDemoAuthAllowed() {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Demo wallet auth is disabled in production; use Telegram initData login');
    }
  }

  private getRegistrationInitialBalance(): bigint {
    return process.env.NODE_ENV === 'production' ? 0n : 100000n;
  }

  async getNonce(address: string) {
    this.assertDemoAuthAllowed();
    const nonce = `BlitzFinale-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const key = `nonce:${address.toLowerCase()}`;
    await this.redis.getClient().setex(key, 300, nonce);
    return { nonce, message: `Sign this nonce to login: ${nonce}` };
  }

  async verifySignature(address: string, signature: string, nonce: string) {
    this.assertDemoAuthAllowed();
    const key = `nonce:${address.toLowerCase()}`;
    const storedNonce = await this.redis.getClient().get(key);

    if (!storedNonce || storedNonce !== nonce) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }
    if (!signature || signature.length < 10) {
      throw new UnauthorizedException('Invalid signature');
    }

    let user = await this.prisma.user.findUnique({
      where: { walletAddress: address.toLowerCase() },
    });

    if (!user) {
      const initialBalance = this.getRegistrationInitialBalance();
      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            walletAddress: address.toLowerCase(),
            nickname: `Player_${address.slice(2, 8)}`,
            balance: initialBalance,
          },
        });

        if (initialBalance > 0n) {
          await tx.ledger.create({
            data: {
              userId: newUser.id,
              type: 'RECHARGE',
              amount: initialBalance,
              balanceBefore: 0n,
              balanceAfter: initialBalance,
              description: 'Demo initial registration funds',
            },
          });
        }

        return newUser;
      });
    }

    await this.redis.getClient().del(key);
    return this.signUser(user);
  }

  async verifyTelegramInitData(initData: string) {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      throw new UnauthorizedException('BOT_TOKEN not configured');
    }
    if (!initData || typeof initData !== 'string') {
      throw new UnauthorizedException('Missing initData');
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      throw new UnauthorizedException('Missing hash in initData');
    }

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const valid =
      computedHash.length === hash.length &&
      crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(hash, 'hex'));
    if (!valid) {
      throw new UnauthorizedException('Invalid Telegram initData signature');
    }

    const authDate = Number(params.get('auth_date') || 0);
    if (!authDate || Date.now() / 1000 - authDate > 86400) {
      throw new UnauthorizedException('Telegram initData expired');
    }

    let tgUser: any;
    try {
      tgUser = JSON.parse(params.get('user') || '{}');
    } catch {
      throw new UnauthorizedException('Invalid Telegram user payload');
    }
    if (!tgUser?.id) {
      throw new UnauthorizedException('Missing Telegram user id');
    }

    const identity = `tg:${tgUser.id}`;
    const nickname =
      tgUser.username ||
      [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') ||
      `TG_${tgUser.id}`;

    let user = await this.prisma.user.findUnique({ where: { walletAddress: identity } });
    if (!user) {
      const initialBalance = this.getRegistrationInitialBalance();
      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            walletAddress: identity,
            nickname,
            avatarUrl: tgUser.photo_url || null,
            balance: initialBalance,
          },
        });

        if (initialBalance > 0n) {
          await tx.ledger.create({
            data: {
              userId: newUser.id,
              type: 'RECHARGE',
              amount: initialBalance,
              balanceBefore: 0n,
              balanceAfter: initialBalance,
              description: 'Telegram registration initial funds',
            },
          });
        }

        return newUser;
      });
    }

    return this.signUser(user);
  }

  private signUser(user: { id: string; walletAddress: string; nickname: string | null; balance: bigint }) {
    const token = this.jwtService.sign({
      sub: user.id,
      address: user.walletAddress,
      role: 'user',
    });

    return {
      token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        nickname: user.nickname,
        balance: Number(user.balance) / 100,
      },
    };
  }
}
