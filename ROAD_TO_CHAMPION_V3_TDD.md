# Blitz Finale V3 TDD - Road to Champion

版本：v3.0  
日期：2026-06-02  
范围：基于现有 BlitzFomo 代码框架，将全局 Round FOMO 改造为球队阶段 Road Key 池。  
原则：保留现有充值、提现、Ledger、Plisio、后台鉴权、系统日志、风控基础；新增冠军之路业务层。

## 1. 现有基础复用

可复用模块：

- 用户系统：Telegram 登录、用户余额、冻结状态。
- Ledger：余额变动账本。
- Payment：Plisio 充值、订单状态、webhook。
- Withdrawals：提现申请、审核、拒绝退款。
- Admin：后台登录、RBAC、配置、日志。
- BotConfig：改造成官方赞助/氛围机器人管理。
- GameConfig：扩展为 Road Key 参数配置。
- SystemLog：记录赛果录入、池子结算、赞助注入、异常。

需要弱化/替换：

- 当前全局 Round 倒计时。
- 最后买家 winner 逻辑。
- Bot purchase 逻辑。
- 固定初始奖池。

## 2. 数据模型

### 2.1 Team

```prisma
model Team {
  id              String   @id @default(cuid())
  code            String   @unique
  name            String
  flagUrl         String?
  groupCode       String?
  strengthFactor  Decimal  @default(1.0)
  impliedTop32    Decimal?
  impliedTop16    Decimal?
  impliedTop8     Decimal?
  impliedTop4     Decimal?
  impliedFinal    Decimal?
  impliedChampion Decimal?
  status          TeamStatus @default(ACTIVE)
  currentStage    RoadStage  @default(GROUP)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### 2.2 RoadPool

```prisma
model RoadPool {
  id                  String   @id @default(cuid())
  teamId              String
  stage               RoadStage
  status              PoolStatus @default(OPEN)
  basePrice           BigInt
  currentPrice        BigInt
  soldKeys            Decimal @default(0)
  totalPurchases      BigInt  @default(0)
  prizePool           BigInt  @default(0)
  dividendPaid        BigInt  @default(0)
  superPoolContrib    BigInt  @default(0)
  reserveContrib      BigInt  @default(0)
  sponsorAmount       BigInt  @default(0)
  sponsorBudgetLimit  BigInt  @default(0)
  openAt              DateTime?
  closeAt             DateTime?
  settledAt           DateTime?
  params              Json?
  team                Team @relation(fields: [teamId], references: [id])
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([teamId, stage])
  @@index([status, stage])
}
```

### 2.3 RoadKeyHolding

```prisma
model RoadKeyHolding {
  id              String   @id @default(cuid())
  userId          String
  poolId          String
  keyAmount       Decimal
  costAmount      BigInt
  avgEntryPrice   BigInt
  genesisBoost    Decimal @default(1.0)
  pendingReward   BigInt  @default(0)
  releasedReward  BigInt  @default(0)
  status          HoldingStatus @default(ACTIVE)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, poolId])
  @@index([poolId, status])
}
```

### 2.4 RoadPurchase

```prisma
model RoadPurchase {
  id             String   @id @default(cuid())
  userId         String
  poolId         String
  amount         BigInt
  keyAmount      Decimal
  priceSnapshot  BigInt
  houseFee       BigInt
  prizePart      BigInt
  dividendPart   BigInt
  superPart      BigInt
  reinvestPart   BigInt
  agentPart      BigInt
  reservePart    BigInt
  referralCode   String?
  createdAt      DateTime @default(now())

  @@index([poolId, createdAt])
  @@index([userId, createdAt])
}
```

### 2.5 RoadDividend

```prisma
model RoadDividend {
  id           String   @id @default(cuid())
  purchaseId   String
  poolId       String
  userId       String
  amount       BigInt
  weight       Decimal
  status       RewardStatus @default(PENDING_RELEASE)
  releaseAt    DateTime?
  createdAt    DateTime @default(now())

  @@index([userId, status])
  @@index([poolId])
}
```

### 2.6 SuperJackpot

```prisma
model SuperJackpot {
  id           String @id @default(cuid())
  seasonCode   String @unique
  amount       BigInt @default(0)
  status       JackpotStatus @default(ACTIVE)
  updatedAt    DateTime @updatedAt
}
```

### 2.7 SponsorLedger

```prisma
model SponsorLedger {
  id         String @id @default(cuid())
  poolId     String
  amount     BigInt
  source     SponsorSource @default(OFFICIAL)
  operatorId String?
  note       String?
  createdAt  DateTime @default(now())
}
```

## 3. 枚举

```prisma
enum RoadStage {
  GROUP
  TOP32
  TOP16
  TOP8
  TOP4
  FINAL
  CHAMPION
}

enum TeamStatus {
  ACTIVE
  ADVANCED
  ELIMINATED
  CHAMPION
}

enum PoolStatus {
  DRAFT
  OPEN
  CLOSED
  SETTLED
  CANCELLED
}

enum HoldingStatus {
  ACTIVE
  WON
  LOST
  CLOSED
}

enum RewardStatus {
  PENDING_RELEASE
  RELEASED
  REINVESTED
  CANCELLED
}
```

## 4. 服务拆分

新增后端模块：

```text
apps/api/src/road/
  road.module.ts
  road.controller.ts
  road-admin.controller.ts
  road-pricing.service.ts
  road-purchase.service.ts
  road-dividend.service.ts
  road-settlement.service.ts
  road-sponsor.service.ts
  road-config.service.ts
```

## 5. API 设计

### 5.1 玩家 API

```text
GET  /api/road/state
GET  /api/road/teams
GET  /api/road/pools?stage=&team=
GET  /api/road/pools/:id
POST /api/road/pools/:id/purchase
GET  /api/road/me/holdings
GET  /api/road/me/dividends
POST /api/road/me/reinvest
```

### 5.2 后台 API

```text
GET  /admin/api/road/teams
POST /admin/api/road/teams
PATCH /admin/api/road/teams/:id

GET  /admin/api/road/pools
POST /admin/api/road/pools
PATCH /admin/api/road/pools/:id
POST /admin/api/road/pools/:id/close
POST /admin/api/road/pools/:id/sponsor

POST /admin/api/road/results/advance
POST /admin/api/road/results/eliminate
POST /admin/api/road/results/settle-stage

GET  /admin/api/road/risk
GET  /admin/api/road/profitability
PATCH /admin/api/road/config
```

## 6. 购买流程

必须在单个数据库事务中完成：

1. 校验用户未冻结。
2. 校验 Pool 为 OPEN 且未过 `closeAt`。
3. 计算当前价格。
4. 计算可购买 Key 数量。
5. 锁定用户余额。
6. 扣除 BF。
7. 按动态费率拆分资金。
8. 更新 RoadPool。
9. 更新/创建 RoadKeyHolding。
10. 计算并写入 RoadDividend。
11. 写入 RoadPurchase。
12. 写 Ledger。
13. 广播实时分红和池子更新。

事务伪代码：

```ts
await prisma.$transaction(async (tx) => {
  const pool = await tx.roadPool.findUnique({ where: { id: poolId } })
  assertPoolOpen(pool)

  const price = pricing.calculate(pool, team, config, now)
  const keyAmount = amount / price
  const parts = allocation.calculate(amount, pool, config)

  await ledger.applyLedgerTx(tx, userId, -amount, 'ROAD_KEY_PURCHASE')
  await updatePool(tx, pool, keyAmount, parts)
  await upsertHolding(tx, userId, poolId, keyAmount, price)
  await distributeDividend(tx, poolId, parts.dividendPart)
  await tx.roadPurchase.create(...)
})
```

## 7. 定价服务

输入：

```ts
type PricingInput = {
  basePrice: bigint
  strengthFactor: number
  impliedProbability: number
  soldKeys: number
  liquidityDepth: number
  alpha: number
  openAt: Date
  closeAt: Date
  shockFactor: number
  heatFactor: number
}
```

公式：

```ts
price =
  basePrice
  * strengthFactor
  * survivalFactor
  * Math.pow(1 + soldKeys / liquidityDepth, alpha)
  * timePressure
  * heatFactor
  * shockFactor
```

保护：

```ts
price = clamp(price, minPrice, maxPrice)
```

survivalFactor：

```ts
survivalFactor = clamp(1 / impliedProbability, minSurvivalFactor, maxSurvivalFactor)
```

timePressure：

```ts
progress = 1 - timeLeft / totalOpenTime
timePressure = 1 + gamma * Math.pow(progress, eta)
```

## 8. 动态稳定费

```ts
h = baseFee + liquidityRisk + volatilityRisk - growthBoost
```

建议：

```ts
baseFee = 0.06
liquidityRisk = pendingLiabilityRatio > threshold ? 0.02 - 0.06 : 0
volatilityRisk = poolHeat > threshold ? 0.01 - 0.04 : 0
growthBoost = healthyGrowth ? 0.00 - 0.03 : 0
h = clamp(h, 0.05, 0.20)
```

## 9. 动态分红率

```ts
d = dBase * growthFactor * solvencyFactor * stageFactor
```

```ts
growthFactor = clamp(volume24h / avgVolume72h, 0.75, 1.25)
solvencyFactor = clamp(reservePool / pendingRewardLiability, 0.50, 1.00)
stageFactor = {
  TOP32: 0.75,
  TOP16: 0.85,
  TOP8: 1.00,
  TOP4: 1.10,
  FINAL: 1.20,
  CHAMPION: 1.25
}
```

当 `pendingRewardLiability` 为 0 时，`solvencyFactor = 1`。

## 10. 分红计算

只给当前 Pool 的历史有效持有人。

```ts
weight = keyAmount * ageBoost * genesisBoost * entryDiscountBoost
```

```ts
ageBoost = min(1 + beta * ln(1 + holdingHours), ageBoostCap)
entryDiscountBoost = clamp(currentPrice / avgEntryPrice, 1, 2)
```

```ts
dividend = dividendBudget * weight / totalWeight
```

约束：

- 当前购买者不吃本次自己的分红。
- 分红进入 pending，不直接可提现。
- 单用户单次分红可设置上限，避免超大户吃穿。
- 机器人和官方赞助账户不参与分红。

## 11. 晋级结算

后台录入：

```text
teamId, reachedStage
```

系统动作：

1. 关闭已达成阶段 Pool。
2. 结算命中持有人。
3. 开放下一阶段 Pool。
4. 更新 Team.currentStage。
5. 根据 ShockFactor 重算后续价格。
6. 写系统日志。

分配：

```text
55% -> 命中 Key 持有人 pending reward
25% -> 下一阶段 Pool prizePool
10% -> SuperJackpot
5%  -> ReservePool
5%  -> Platform
```

## 12. 淘汰结算

后台录入：

```text
teamId, eliminatedAtStage
```

系统动作：

1. Team.status = ELIMINATED。
2. 关闭全部后续 Pool。
3. 将未结算 future pool 标记 LOST。
4. 迁移资金。
5. 失效折扣券。
6. 写系统日志。

分配：

```text
45% -> SuperJackpot
25% -> SurvivorPublicPool
15% -> ReservePool
10% -> Platform
5%  -> Activity/KOL budget
```

## 13. 官方赞助服务

后台注入：

```text
POST /admin/api/road/pools/:id/sponsor
```

要求：

- 只能管理员操作。
- 不能超过 pool.sponsorBudgetLimit。
- 写 SponsorLedger。
- 更新 pool.sponsorAmount 和 prizePool/superPool。
- Sponsor 不生成 Key，不参与分红。
- 前台显示为 `Official Sponsored`。

## 14. 机器人服务

现有 bot 模块改为：

```text
AtmosphereBot
MarketNoticeBot
OfficialBoostScheduler
```

允许事件：

- 弹幕。
- 赛程提醒。
- 热门池提醒。
- 官方赞助执行提醒。

禁止事件：

- fake purchase 进入 RoadPurchase。
- fake withdrawal。
- fake winner。
- bot holding。
- bot dividend。

## 15. 前台改造

当前 `web/index.html` 或 TMA UI 需要重构为：

```text
Header:
  Logo, language, BF balance, deposit

Hero:
  Super Champion Jackpot
  Total real purchases
  Official sponsored amount

Stage Tabs:
  Top32, Top16, Top8, Top4, Final, Champion

Team Route Cards:
  flag/name
  stage
  current key price
  sold keys
  prize pool
  dividends paid
  close countdown
  status badge
  buy button

Live Feed:
  real purchases
  real dividends
  official sponsor events

Profile:
  holdings
  pending rewards
  released rewards
  reinvest
  withdraw
  referral
```

UI 文案：

- 不写「下注」。
- 不写「稳赚」。
- 不写「去中心化合约」。
- 使用「冠军之路 Key」「官方赞助池」「待释放收益」「超级冠军池」。

## 16. 后台改造

新增菜单：

- 冠军之路总览。
- 球队管理。
- 阶段池管理。
- 曲线参数。
- 赛果录入。
- 官方赞助。
- 分红负债。
- KOL/代理。
- 提现释放。

总览指标：

- 总购买额。
- 平台费收入。
- 待释放负债。
- 储备覆盖率。
- 超级冠军池。
- 官方赞助已用。
- KOL 佣金待付。
- 池子健康度。

## 17. 风控约束

P0 风控：

- Pool 关闭后不能购买。
- 淘汰球队不能购买后续阶段。
- 官方赞助账户不能提现。
- Bot 不能持 Key。
- 分红不能超过 DividendBudget。
- 提现只能提 released balance。
- 管理员赛果录入需要二次确认。
- 结算必须幂等。

## 18. 测试清单

单元测试：

- 定价公式 clamp。
- 动态稳定费。
- 动态分红率。
- 分红权重。
- 晋级资金流。
- 淘汰资金流。
- Sponsor 不生成 holding。

集成测试：

- 用户充值 -> 买 Key -> 后续购买 -> 前人 pending 分红增加。
- Pool close 后购买失败。
- 晋级后 rewards 进入 pending。
- 淘汰后 future pools 关闭。
- Sponsor 注入显示但不分红。
- released balance 才能提现。

端到端：

- 前台购买流程。
- 我的持仓与收益显示。
- 后台录入晋级。
- 后台录入淘汰。
- KOL 佣金生成。
- 提现审核。

## 19. 改造量预估

基于当前项目已有支付、提现、后台、日志、风控：

### MVP：8-12 天

- 数据模型与迁移：1 天。
- Road 后端核心：3-4 天。
- 分红/结算/赞助：2-3 天。
- 前台 UI：2-3 天。
- 后台 UI：2-3 天。
- 测试与修复：1-2 天。

可多人并行时，压缩到 6-8 天，但风险更高。

### 产品级：14-21 天

- KOL 账本。
- 折扣券。
- 复投加速。
- 证明墙。
- 多语言精修。
- 完整风控审计。

## 20. 不建议第一版实现

- 自动体育数据 API。
- 实时盘口赔率。
- 复杂二级交易市场。
- 用户之间 Key 转让。
- 链上证明。

第一版使用后台手动录入赛果，自动触发价格变化和 Pool 状态变化。

