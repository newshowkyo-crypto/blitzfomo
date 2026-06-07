# 全链路测试问题报告

**测试时间**: 2026-05-31  
**测试模型**: Claude Opus 4.8 (1M context)  
**测试环境**: Docker Compose 本地环境

---

## 🔴 严重问题（Critical）

### 1. 用户初始余额错误 ⚠️⚠️⚠️
**问题描述**：
- **期望值**: 100000 最小单位（1000 BF）
- **实际值**: 1000 最小单位（10 BF）
- **影响**: 新用户初始余额只有 10 BF，无法正常游戏

**测试结果**：
```json
{
  "balance": 1000,  // 应该是 100000
  "totalPurchased": 0,
  "totalWon": 0
}
```

**根本原因**：
- 可能在 `auth.service.ts` 或 `user.service.ts` 中初始余额写入时少了两个零
- 或者在 seed 脚本中配置错误

**修复建议**：
```typescript
// 应该是
const INITIAL_BALANCE = 100000; // 1000 BF

// 而不是
const INITIAL_BALANCE = 1000; // 10 BF
```

---

### 2. 奖池数据不一致 ⚠️⚠️⚠️
**问题描述**：
- **游戏状态接口** (`/api/game/state`): 返回 1550
- **仪表盘接口** (`/admin/api/dashboard/stats`): 返回 100000
- **差异**: 64 倍差异

**测试结果**：
```bash
游戏状态接口奖池: 1550
仪表盘接口奖池: 100000
```

**根本原因**：
- 两个接口读取的数据源不一致
- 可能一个从 Redis 读取，一个从 Postgres 读取
- 或者单位转换不一致（一个是最小单位，一个是 BF）

**修复建议**：
- 统一数据源：都从 Redis 读取实时数据
- 统一单位：都返回最小单位，前端负责转换

---

### 3. 提现风控未生效 ⚠️⚠️
**问题描述**：
- 新用户（0 次购买）应该被风控拦截
- 实际只检查了最低提现金额，未检查购买次数

**测试结果**：
```json
{
  "msg": ["amountUsdt must not be less than 10"]
}
```
- ❌ 应该返回：`"购买次数不足，需要至少 N 次购买"`
- ✅ 只返回了金额校验错误

**根本原因**：
- `withdraw.service.ts` 中风控逻辑未正确实现
- 或者风控配置中 `withdrawRequirePurchaseCount` 设置为 0

**修复建议**：
```typescript
// 检查购买次数
const purchaseCount = await this.prisma.purchase.count({
  where: { userId, isBot: false }
});

if (purchaseCount < riskConfig.withdrawRequirePurchaseCount) {
  throw new BadRequestException(
    `需要至少 ${riskConfig.withdrawRequirePurchaseCount} 次购买才能提现`
  );
}

// 检查冷却时间
const lastWithdraw = await this.prisma.withdrawal.findFirst({
  where: { userId, status: { in: ['PAID', 'APPROVED'] } },
  orderBy: { createdAt: 'desc' }
});

if (lastWithdraw) {
  const cooldownHours = riskConfig.withdrawCooldownHours;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const timeSinceLastWithdraw = Date.now() - lastWithdraw.createdAt.getTime();
  
  if (timeSinceLastWithdraw < cooldownMs) {
    throw new BadRequestException(
      `提现冷却中，请在 ${Math.ceil((cooldownMs - timeSinceLastWithdraw) / 3600000)} 小时后重试`
    );
  }
}
```

---

### 4. Mock 支付未自动完成 ⚠️⚠️
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

**根本原因**：
- `MockGateway` 的自动回调逻辑未实现
- 或者回调延迟过长

**修复建议**：
```typescript
// MockGateway.createOrder() 中
async createOrder(payment: Payment): Promise<PaymentResult> {
  // ... 创建订单逻辑
  
  // 自动触发回调（延迟 2 秒模拟真实支付）
  setTimeout(async () => {
    await this.paymentService.handleCallback({
      gateway: 'mock',
      orderId: payment.id,
      status: 'PAID',
      paidAmount: payment.amountUsdt
    });
  }, 2000);
  
  return result;
}
```

---

## 🟡 中等问题（Medium）

### 5. 购买响应缺少用户余额 ⚠️
**问题描述**：
- 购买成功后，响应中只有游戏状态，没有用户新余额
- 前端需要额外调用 `/api/user/profile` 才能更新余额显示

**测试结果**：
```json
{
  "success": true,
  "state": { ... },
  // 缺少 "balance": 95000
}
```

**修复建议**：
```typescript
// purchase.service.ts
return {
  success: true,
  balance: user.balance, // 添加用户新余额
  state: gameState
};
```

---

### 6. 幂等性错误处理不友好 ⚠️
**问题描述**：
- 重复的 idempotencyKey 返回数据库错误，而不是友好提示
- 应该返回第一次的结果或明确的重复提示

**测试结果**：
```json
{
  "msg": "Unique constraint failed on the fields: (`idempotency_key`)"
}
```

**修复建议**：
```typescript
// 先检查是否已存在
const existingPurchase = await this.prisma.purchase.findUnique({
  where: { idempotencyKey }
});

if (existingPurchase) {
  // 返回之前的结果
  return {
    success: true,
    balance: user.balance,
    state: await this.getGameState()
  };
}
```

---

### 7. 余额不足错误提示不准确 ⚠️
**问题描述**：
- 余额不足时返回 "Amount exceeds per-transaction limit"
- 应该明确说明是余额不足

**测试结果**：
```json
{
  "msg": "Amount exceeds per-transaction limit"
}
```

**修复建议**：
- 先检查余额，再检查单笔限额
- 返回更明确的错误信息

---

### 8. 最低购买金额校验在前端 ⚠️
**问题描述**：
- 小于 1 BF 的购买被 DTO 验证拦截
- 应该返回更友好的业务错误

**测试结果**：
```json
{
  "msg": ["amount must not be less than 1"]
}
```

**修复建议**：
- 使用业务异常而不是验证异常
- 返回多语言友好提示

---

## 🟢 轻微问题（Minor）

### 9. 健康检查接口不存在
**问题描述**：
- `/health` 接口返回 404
- 应该返回服务健康状态

**测试结果**：
```json
{
  "msg": "Cannot GET /health"
}
```

**修复建议**：
```typescript
@Get('health')
healthCheck() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
}
```

---

## ✅ 正常功能

以下功能测试通过：

1. ✅ **用户登录流程** - nonce 获取和签名验证正常
2. ✅ **游戏状态查询** - 返回完整游戏状态
3. ✅ **购买功能** - 核心购买逻辑正常（除余额显示问题）
4. ✅ **最近购买记录** - 查询正常
5. ✅ **充值订单创建** - 订单创建正常
6. ✅ **管理员登录** - 认证正常
7. ✅ **管理员仪表盘** - 数据查询正常
8. ✅ **游戏配置查询** - 配置读取正常
9. ✅ **用户列表查询** - 分页查询正常

---

## 📋 问题优先级

### P0 - 必须立即修复（阻塞上线）
1. ❌ 用户初始余额错误（1000 → 100000）
2. ❌ 奖池数据不一致
3. ❌ 提现风控未生效

### P1 - 应该尽快修复（影响体验）
4. ⚠️ Mock 支付未自动完成
5. ⚠️ 购买响应缺少用户余额
6. ⚠️ 幂等性错误处理不友好

### P2 - 可以后续优化（体验优化）
7. 💡 余额不足错误提示优化
8. 💡 最低购买金额提示优化
9. 💡 健康检查接口添加

---

## 🔧 修复建议总结

### 立即修复（代码层面）

#### 1. 修复初始余额
**文件**: `apps/api/src/auth/auth.service.ts` 或 `apps/api/src/user/user.service.ts`

```typescript
// 查找并修改
const INITIAL_BALANCE = 100000; // 1000 BF (最小单位)
```

#### 2. 统一奖池数据源
**文件**: `apps/api/src/admin/admin.service.ts`

```typescript
// 从 Redis 读取实时奖池，而不是从数据库
async getDashboardStats() {
  const gameState = await this.gameService.getState(); // 从 Redis
  return {
    ...stats,
    currentRound: {
      roundNumber: gameState.roundNumber,
      prizePool: gameState.prizePool // 使用 Redis 数据
    }
  };
}
```

#### 3. 实现提现风控
**文件**: `apps/api/src/withdraw/withdraw.service.ts`

```typescript
async create(userId: string, dto: CreateWithdrawDto) {
  // 1. 检查购买次数
  const purchaseCount = await this.prisma.purchase.count({
    where: { userId, isBot: false }
  });
  
  const riskConfig = await this.getRiskConfig();
  
  if (purchaseCount < riskConfig.withdrawRequirePurchaseCount) {
    throw new BadRequestException(
      `需要至少 ${riskConfig.withdrawRequirePurchaseCount} 次购买才能提现`
    );
  }
  
  // 2. 检查冷却时间
  // ... (见上文详细代码)
  
  // 3. 继续原有逻辑
}
```

#### 4. 修复 Mock 支付自动回调
**文件**: `apps/api/src/payment/gateways/mock.gateway.ts`

```typescript
async createOrder(payment: Payment): Promise<PaymentResult> {
  // ... 创建订单
  
  // 异步触发自动回调
  setTimeout(() => {
    this.autoCallback(payment.id);
  }, 2000);
  
  return result;
}

private async autoCallback(paymentId: string) {
  await this.paymentService.handleMockCallback(paymentId);
}
```

---

## 📊 测试覆盖率

| 功能模块 | 测试项 | 通过 | 失败 | 覆盖率 |
|---------|-------|------|------|--------|
| 用户认证 | 2 | 2 | 0 | 100% |
| 游戏状态 | 3 | 2 | 1 | 67% |
| 购买功能 | 5 | 3 | 2 | 60% |
| 充值提现 | 4 | 1 | 3 | 25% |
| 管理后台 | 3 | 3 | 0 | 100% |
| **总计** | **17** | **11** | **6** | **65%** |

---

## 🎯 修复后验证清单

修复完成后，请执行以下验证：

```bash
# 1. 验证初始余额
curl -s http://localhost:3000/api/user/profile -H "Authorization: Bearer $TOKEN" | grep balance
# 期望: "balance":100000

# 2. 验证奖池一致性
curl -s http://localhost:3000/api/game/state | grep prizePool
curl -s http://localhost:3000/admin/api/dashboard/stats -H "Authorization: Bearer $ADMIN_TOKEN" | grep prizePool
# 期望: 两个值相同

# 3. 验证提现风控
# 新用户直接提现应该被拦截
curl -s -X POST http://localhost:3000/api/withdraw \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NEW_USER_TOKEN" \
  -d '{"amountUsdt":10,"toAddress":"TTest","chain":"TON"}'
# 期望: 返回购买次数不足错误

# 4. 验证 Mock 支付
# 创建订单后等待 3 秒查询状态
ORDER_ID=$(curl -s -X POST http://localhost:3000/api/payment/create ...)
sleep 3
curl -s http://localhost:3000/api/payment/$ORDER_ID
# 期望: "status":"PAID"
```

---

## 📝 总结

### 发现的问题
- **严重问题**: 4 个（必须修复）
- **中等问题**: 4 个（建议修复）
- **轻微问题**: 1 个（可选优化）

### 核心问题
1. 初始余额配置错误（少了两个零）
2. 数据源不统一（Redis vs Postgres）
3. 风控逻辑未实现
4. Mock 支付回调未实现

### 修复工作量估算
- **P0 问题**: 2-4 小时
- **P1 问题**: 2-3 小时
- **P2 问题**: 1-2 小时
- **总计**: 5-9 小时

### 建议
1. **立即修复 P0 问题**，否则无法正常游戏
2. **尽快修复 P1 问题**，提升用户体验
3. **P2 问题可以后续优化**

---

**测试完成时间**: 2026-05-31  
**项目状态**: ⚠️ **发现严重问题，需要修复后才能上线**
