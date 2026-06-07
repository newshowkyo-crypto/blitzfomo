# 全链路测试问题报告（修正版）

**测试时间**: 2026-05-31  
**测试模型**: Claude Opus 4.8 (1M context)  
**测试环境**: Docker Compose 本地环境

---

## ✅ 重要澄清

### 初始余额问题 - 实际正常 ✅
**之前误判**：认为余额 1000 是错误的  
**实际情况**：
- 数据库存储：100000（最小单位）
- API 返回：1000（BF 单位，已除以100）
- 前端显示：$1000.00 BF

**结论**：✅ 初始余额逻辑正确，无需修复

---

## 🔴 真实严重问题（Critical）

### 1. 奖池数据不一致 ⚠️⚠️⚠️
**问题描述**：
- **游戏状态接口** (`/api/game/state`): 返回 1550（BF 单位）
- **仪表盘接口** (`/admin/api/dashboard/stats`): 返回 100000（最小单位）
- **问题**：单位不统一，一个是 BF，一个是最小单位

**测试结果**：
```bash
游戏状态接口奖池: 1550 (BF)
仪表盘接口奖池: 100000 (最小单位)
实际应该: 1550 BF = 155000 最小单位
```

**根本原因**：
- 游戏状态接口从 Redis 读取并已转换为 BF
- 仪表盘接口从数据库读取，返回的是最小单位
- 两个接口单位不统一

**修复方案**：
```typescript
// apps/api/src/admin/admin.service.ts
async getDashboardStats() {
  // 方案1: 统一返回最小单位
  const currentRound = await this.prisma.round.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' }
  });
  
  return {
    ...stats,
    currentRound: {
      roundNumber: currentRound.roundNumber,
      prizePool: Number(currentRound.prizePool) // 最小单位
    }
  };
  
  // 或方案2: 从 Redis 读取实时数据
  const gameState = await this.gameService.getState();
  return {
    ...stats,
    currentRound: {
      roundNumber: gameState.roundNumber,
      prizePool: gameState.prizePool * 100 // 转换为最小单位
    }
  };
}
```

---

### 2. 提现风控未完全实现 ⚠️⚠️
**问题描述**：
- 新用户（0 次购买）应该被风控拦截
- 实际只检查了最低提现金额，未检查购买次数和冷却时间

**测试结果**：
```json
{
  "msg": ["amountUsdt must not be less than 10"]
}
```
- ❌ 应该返回：`"购买次数不足，需要至少 N 次购买"`

**修复方案**：
```typescript
// apps/api/src/withdraw/withdraw.service.ts
async create(userId: string, dto: CreateWithdrawDto) {
  // 1. 获取风控配置
  const riskConfig = await this.configService.getRiskConfig();
  
  // 2. 检查购买次数
  const purchaseCount = await this.prisma.purchase.count({
    where: { 
      userId,
      isBot: false 
    }
  });
  
  if (purchaseCount < riskConfig.withdrawRequirePurchaseCount) {
    throw new BadRequestException(
      `需要至少 ${riskConfig.withdrawRequirePurchaseCount} 次购买才能提现，当前 ${purchaseCount} 次`
    );
  }
  
  // 3. 检查冷却时间
  const lastWithdraw = await this.prisma.withdrawal.findFirst({
    where: { 
      userId,
      status: { in: ['PAID', 'APPROVED'] }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  if (lastWithdraw) {
    const cooldownMs = riskConfig.withdrawCooldownHours * 60 * 60 * 1000;
    const timeSinceLastWithdraw = Date.now() - lastWithdraw.createdAt.getTime();
    
    if (timeSinceLastWithdraw < cooldownMs) {
      const remainingHours = Math.ceil((cooldownMs - timeSinceLastWithdraw) / 3600000);
      throw new BadRequestException(
        `提现冷却中，请在 ${remainingHours} 小时后重试`
      );
    }
  }
  
  // 4. 继续原有逻辑...
}
```

---

### 3. Mock 支付未自动完成 ⚠️⚠️
**问题描述**：
- Mock 网关应该自动回调并标记订单为 PAID
- 实际订单创建后仍然是 PENDING 状态

**测试结果**：
```json
{
  "status": "PENDING",
  "paidAt": null
}
```

**修复方案**：
```typescript
// apps/api/src/payment/gateways/mock.gateway.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class MockGateway implements PaymentGateway {
  constructor(
    private readonly paymentService: PaymentService
  ) {}
  
  async createOrder(payment: Payment): Promise<PaymentResult> {
    const result = {
      orderId: payment.id,
      payUrl: `https://mock-pay.blitzfinale.local/pay/${payment.id}`,
      qrCode: `mock-qr-${payment.id}`,
      extra: {
        message: 'This is a MOCK payment. It will succeed automatically in 2 seconds.'
      },
      gateway: 'mock'
    };
    
    // 异步触发自动回调（2秒后）
    setTimeout(async () => {
      try {
        await this.paymentService.handleMockCallback(payment.id);
      } catch (error) {
        console.error('Mock callback failed:', error);
      }
    }, 2000);
    
    return result;
  }
}

// apps/api/src/payment/payment.service.ts
async handleMockCallback(paymentId: string) {
  const payment = await this.prisma.payment.findUnique({
    where: { id: paymentId }
  });
  
  if (!payment || payment.status !== 'PENDING') {
    return;
  }
  
  // 标记为已支付
  await this.prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'PAID',
      paidAt: new Date()
    }
  });
  
  // 入账
  await this.ledgerService.applyLedger({
    userId: payment.userId,
    type: 'RECHARGE',
    amount: payment.amountUsdt,
    relatedId: payment.id,
    remark: 'Mock payment auto-completed'
  });
}
```

---

## 🟡 中等问题（Medium）

### 4. 购买响应缺少用户余额 ⚠️
**问题描述**：
- 购买成功后，响应中只有游戏状态，没有用户新余额
- 前端需要额外调用 `/api/user/profile` 才能更新余额显示

**修复方案**：
```typescript
// apps/api/src/game/purchase.service.ts
async purchase(userId: string, amount: number, idempotencyKey: string) {
  // ... 购买逻辑
  
  // 获取用户最新余额
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true }
  });
  
  return {
    success: true,
    balance: Number(user.balance) / 100, // 返回 BF 单位
    state: await this.getGameState()
  };
}
```

---

### 5. 幂等性错误处理不友好 ⚠️
**问题描述**：
- 重复的 idempotencyKey 返回数据库错误，而不是友好提示

**修复方案**：
```typescript
// apps/api/src/game/purchase.service.ts
async purchase(userId: string, amount: number, idempotencyKey: string) {
  // 先检查是否已存在
  const existingPurchase = await this.prisma.purchase.findUnique({
    where: { idempotencyKey }
  });
  
  if (existingPurchase) {
    // 返回之前的结果
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true }
    });
    
    return {
      success: true,
      balance: Number(user.balance) / 100,
      state: await this.getGameState(),
      duplicate: true // 标记为重复请求
    };
  }
  
  // 继续正常购买逻辑...
}
```

---

### 6. 余额不足错误提示不准确 ⚠️
**问题描述**：
- 余额不足时返回 "Amount exceeds per-transaction limit"
- 应该明确说明是余额不足还是单笔限额

**修复方案**：
```typescript
// 先检查余额
if (user.balance < amount * 100) {
  throw new BadRequestException('余额不足');
}

// 再检查单笔限额
if (amount > riskConfig.purchaseMaxAmountPerTx / 100) {
  throw new BadRequestException('超过单笔购买限额');
}
```

---

## 🟢 轻微问题（Minor）

### 7. 最低购买金额校验提示优化
**当前**：`["amount must not be less than 1"]`  
**建议**：`"购买金额不能低于 1 BF"`

### 8. 健康检查接口缺失
**建议添加**：`GET /health` 或 `GET /api/health`

---

## 📋 修复优先级

### P0 - 必须立即修复
1. ❌ 奖池数据单位不统一
2. ❌ 提现风控未实现
3. ❌ Mock 支付未自动完成

### P1 - 应该尽快修复
4. ⚠️ 购买响应缺少余额
5. ⚠️ 幂等性错误处理

### P2 - 可以后续优化
6. 💡 错误提示优化
7. 💡 健康检查接口

---

## 🔧 快速修复脚本

我将立即修复这些问题。请确认是否继续？

---

**测试完成时间**: 2026-05-31  
**项目状态**: ⚠️ **发现 3 个严重问题，需要修复**
