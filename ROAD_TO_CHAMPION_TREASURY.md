# Road to Champion Treasury Guide

版本：v1.0
日期：2026-06-02
适用范围：Blitz Finale V3 Road to Champion 财务管理

---

## 1. 总账架构

RoadTreasury 总账记录所有 Road 资金的流入和流出。每个事件都会生成一条 RoadTreasuryLedger 记录，包含：

- `eventType`：事件类型（purchase / sponsor / advance / eliminate / reward_release / bot_cancelled）
- `eventId`：事件唯一 ID（如 purchaseId、sponsorLedgerId）
- `entryKey`：同一事件内的唯一 key（如 `houseFee_${purchaseId}`）
- `bucket`：资金桶（houseFee / poolPrize / pendingReward / superJackpot / reinvest / agent / reserve）
- `amount`：金额（单位：BF 分，即 0.01 BF）
- `poolId`：关联池子（可选）
- `purchaseId`：关联购买（可选）

### 1.1 Bucket 说明

| Bucket | 说明 | 来源 | 去向 |
|--------|------|------|------|
| houseFee | 平台收取的手续费 | purchase, sponsor | 平台收益 |
| poolPrize | 奖池 | purchase, sponsor | holders reward, next pool |
| pendingReward | 待释放奖励 | purchase, sponsor | user released |
| superJackpot | 超级冠军池 | purchase, sponsor, eliminate | 冠军奖励 |
| reinvest | 复投池 | purchase | reinvest release |
| agent | 代理佣金 | purchase | KOL released |
| reserve | 储备池 | purchase, eliminate | 覆盖 pendingReward 波动 |

---

## 2. 资金流

### 2.1 购买（purchase）

每次购买金额 X 的分配比例（由 RoadConfig 决定）：

```
houseFee    = X * houseFeeBps / 10000
poolPrize   = X * prizeBps / 10000
pendingReward = X * dividendBps / 10000
superJackpot  = X * superBps / 10000
reinvest     = X * reinvestBps / 10000
agent        = X * agentBps / 10000
reserve      = X * reserveBps / 10000
```

每笔 purchase 事件写多条 ledger：
- `purchase_HOUSE FEE_[purchaseId]` → bucket: houseFee
- `purchase_POOL PRIZE_[purchaseId]` → bucket: poolPrize
- `purchase_PENDING_[purchaseId]` → bucket: pendingReward
- `purchase_SUPER_[purchaseId]` → bucket: superJackpot
- `purchase_REINVEST_[purchaseId]` → bucket: reinvest
- `purchase_AGENT_[purchaseId]` → bucket: agent
- `purchase_RESERVE_[purchaseId]` → bucket: reserve

### 2.2 官方赞助（sponsor）

赞助金额 Y 的分配：

```
poolPrize   = Y * prizeBps / 10000
superJackpot = Y * superBps / 10000
reserve     = Y - poolPrize - superJackpot
```

每笔 sponsor 写多条 ledger：
- `sponsor_POOL PRIZE_[sponsorLedgerId]` → bucket: poolPrize
- `sponsor_SUPER_[sponsorLedgerId]` → bucket: superJackpot
- `sponsor_RESERVE_[sponsorLedgerId]` → bucket: reserve

### 2.3 晋级（advance）

晋级时，池子 prizePool 清零并重新分配：

```
holders reward = pool.prizePool * dividendBps / (dividendBps + prizeBps + superBps)
next pool      = pool.prizePool * prizeBps / (dividendBps + prizeBps + superBps)
super          = pool.prizePool * superBps / (dividendBps + prizeBps + superBps)
platformCarry  = pool.prizePool * houseFeeBps / (dividendBps + prizeBps + superBps + houseFeeBps)
```

每笔 advance 写多条 ledger（幂等，不会重复）：
- `advance_POOL PRIZE_ZERO_[poolId]` → bucket: poolPrize（负数）
- `advance_HOLDERS_[poolId]` → bucket: pendingReward（从 poolPrize 转入 holders）
- `advance_NEXT_[poolId]` → bucket: poolPrize（下一池）
- `advance_SUPER_[poolId]` → bucket: superJackpot
- `advance_PLATFORM_[poolId]` → bucket: houseFee

### 2.4 淘汰（eliminate）

淘汰时，所有未结算 future pools 清零并重新分配：

```
survivor pool = futurePoolSum * prizeBps / (prizeBps + superBps)
super         = futurePoolSum * superBps / (prizeBps + superBps)
platform      = futurePoolSum * houseFeeBps / (prizeBps + superBps + houseFeeBps)
activity      = futurePoolSum * reserveBps / (prizeBps + superBps + houseFeeBps)
```

每笔 eliminate 写多条 ledger（幂等）：
- `eliminate_POOL PRIZE_ZERO_[teamId]_[stage]` → bucket: poolPrize（负数）
- `eliminate_SUPER_[teamId]_[stage]` → bucket: superJackpot
- `eliminate_SURVIVOR_[teamId]_[stage]` → bucket: poolPrize（幸存池）
- `eliminate_PLATFORM_[teamId]_[stage]` → bucket: houseFee
- `eliminate_RESERVE_[teamId]_[stage]` → bucket: reserve

### 2.5 奖励释放（reward_release）

奖励延迟释放时：

```
pendingReward -= X   (bucket: pendingReward，负数)
userReleased  += X   (bucket 不变，通过 user ledger 更新)
user balance   += X   (通过 user ledger 更新)
```

Ledger 记录：
- `reward_PENDING_[dividendId]` → bucket: pendingReward（负数）

### 2.6 Bot 取消奖励（bot_cancelled）

Bot 的 pendingReward 取消时：

```
pendingReward -= X   (bucket: pendingReward，负数)
reserve       += X   (bucket: reserve)
```

Ledger 记录：
- `bot_cancel_PENDING_[holdingId]` → bucket: pendingReward（负数）
- `bot_cancel_RESERVE_[holdingId]` → bucket: reserve

---

## 3. Treasury Reconcile

### 3.1 API

```bash
curl -X GET /admin/api/road/treasury/reconcile \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

返回结构：
```json
{
  "seasonCode": "WC2026",
  "buckets": {
    "houseFee": "123456",
    "poolPrize": "234567",
    "pendingReward": "345678",
    "superJackpot": "456789",
    "reinvest": "56789",
    "agent": "67890",
    "reserve": "78901"
  },
  "orphanRecords": [],
  "poolPrizeDiff": 0,
  "pendingRewardDiff": 0,
  "superJackpotDiff": 0,
  "ok": true
}
```

### 3.2 Diff 说明

- `poolPrizeDiff`：池子表 prizePool 汇总与 treasury POOL_PRIZE bucket 的差值
- `pendingRewardDiff`：holding 表 pendingReward 汇总与 treasury PENDING_REWARD bucket 的差值
- `superJackpotDiff`：superJackpot 表与 treasury SUPER_JACKPOT bucket 的差值

Diff = 0 表示账目一致。

### 3.3 Orphan Records

如果有 `orphanRecords`，说明有 treasury 记录但没有对应的事件来源，需要人工排查。

### 3.4 验证脚本

```bash
node scripts/verify-road-v3.js
```

测试会验证：
- ROAD_TREASURY_RECONCILE_OK：reconcile 必须返回 ok=true

---

## 4. 储备覆盖率

储备池用于覆盖 pendingReward 的波动风险。

覆盖率 = treasury.reserve / treasury.pendingReward

健康阈值：reserve 应 >= pendingReward 的 50%（由 `lowCoverageThresholdBps` 控制）

如果储备覆盖率低于阈值，House Fee 会自动上调以补充储备（由 `maxHouseFeeBps` 控制）。

在 `RoadOverview` 和 `RoadLiability` 页面可以查看储备覆盖率。

---

## 5. 负债管理

### 5.1 Pending Reward 负债

- `pendingReward` 是负债，表示已承诺但尚未释放给用户的奖励
- 不能用于提现或平台支出
- 随着 releaseDelayHours 推移自动释放

### 5.2 Released Reward 负债

- `releasedReward` 是已释放但尚未提现的奖励
- 用户可以提现
- 储备池必须有足够余额覆盖 releasedReward

### 5.3 监控要点

在 `RoadLiability` 页面监控：
- totalPendingReward：总待释放负债
- totalReleasedReward：总已释放未提现负债
- reserveCoverage：储备覆盖率 = reserve / (pendingReward + releasedReward)
- treasuryHealth：如果 reserveCoverage < 50%，需要补充储备或减少负债
