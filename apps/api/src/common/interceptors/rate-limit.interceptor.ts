// apps/api/src/common/interceptors/rate-limit.interceptor.ts
// 简单 Redis 滑动窗口限流（P1 待完善，可根据需要加强）

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const ip = req.ip || req.connection.remoteAddress;
    const key = `rate:ip:${ip}`;

    const count = await this.redis.getClient().incr(key);
    if (count === 1) {
      await this.redis.getClient().expire(key, 60); // 每分钟窗口
    }

    if (count > 120) { // 简单限制
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    return next.handle();
  }
}