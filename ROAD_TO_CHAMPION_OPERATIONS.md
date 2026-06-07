# Road to Champion Operations Guide

版本：v1.0  
日期：2026-06-02  
适用范围：Blitz Finale V3 Road to Champion 生产运营

---

## 1. 配置 Plisio

### 1.1 设置回调地址

在 Plisio 商户后台设置状态回调 URL：

```
https://[YOUR_DOMAIN]/api/payment/webhook/plisio?json=true
```

### 1.2 生产环境变量

```env
ACTIVE_PAYMENT_GATEWAY=plisio
PLISIO_API_KEY=[YOUR_API_KEY]
PLISIO_ALLOWED_PSYS_CIDS=USDT_TRX,USDT_BSC,BTC,ETH,LTC,TRX
PLISIO_SOURCE_CURRENCY=USD
PLISIO_EXPIRE_MIN=60
PUBLIC_API_BASE_URL=https://[YOUR_DOMAIN]
TMA_PUBLIC_URL=https://[YOUR_DOMAIN]
```

### 1.3 切换 Mock（紧急回退）

如果 Plisio 出现故障，临时切换：

```env
ACTIVE_PAYMENT_GATEWAY=mock
```

然后重启 API：
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d api
```

---

## 2. 配置 Sponsor Budget

### 2.1 全局预算

在后台 `RoadSponsor` 页面配置全局 Official Sponsor 总预算。

或者通过 API：
```bash
# 获取当前预算
curl -X GET /admin/api/road/sponsor/budget \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 更新预算
curl -X PATCH /admin/api/road/sponsor/budget \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"totalBudget": 1000000, "status": "ACTIVE"}'
```

### 2.2 单池 Sponsor Limit

在 `RoadPools` 页面创建/编辑池时设置 `sponsorBudgetLimit`。

### 2.3 注入 Sponsor

在 `RoadSponsor` 页面选择一个池，注入官方赞助金额和 reference。

校验规则：
- 全局 remainingBudget >= amount
- 该池已注入 + amount <= sponsorBudgetLimit
- reference 不能重复使用（幂等）

---

## 3. 创建球队和池子

### 3.1 创建球队

在 `RoadTeams` 页面创建球队：
- name：球队名称
- code：球队代码（如 BRA, ARG, JPN）
- flagEmoji：国旗 emoji（如 🇧🇷）
- group：分组（如 A, B, C）
- strength：实力系数（1-10）
- currentStage：当前阶段（默认 TOP32）
- status：状态（ACTIVE）

### 3.2 创建池子

在 `RoadPools` 页面创建池：
- teamId：选择球队
- stage：选择阶段（TOP32/TOP16/QUARTER/SEMI/FINAL/CHAMPION）
- basePrice：初始价格（单位：BF 分，即 0.01 BF）
- sponsorBudgetLimit：单池 Sponsor 上限

池创建后状态为 OPEN，可接受购买。

### 3.3 通过 API 创建

```bash
curl -X POST /admin/api/road/teams \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Brazil",
    "code": "BRA",
    "flagEmoji": "🇧🇷",
    "group": "G",
    "strength": 9,
    "currentStage": "TOP32",
    "status": "ACTIVE"
  }'

curl -X POST /admin/api/road/pools \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "[TEAM_ID]",
    "stage": "TOP32",
    "basePrice": 500,
    "sponsorBudgetLimit": 1000000
  }'
```

---

## 4. 录入晋级/淘汰（核心操作）

**警告：晋级/淘汰操作不可逆，必须严格按 preview -> confirm 流程执行。**

### 4.1 晋级操作

1. 进入 `RoadResults` 页面
2. 选择球队和到达阶段
3. 点击 **Preview晋级**：
   - 查看预计资金迁移：pool prize -> holders reward / next pool / super / reserve / platformCarry
   - 查看影响池子和持有人数量
   - 查看待发奖励
4. 确认无误后点击 **Confirm晋级**
5. SystemLog 记录操作

### 4.2 淘汰操作

1. 进入 `RoadResults` 页面
2. 选择球队和淘汰阶段
3. 点击 **Preview淘汰**：
   - 查看 future pools 关闭情况
   - 查看资金迁移：future pools -> super / survivor / reserve / platform / activity
4. 确认无误后点击 **Confirm淘汰**
5. SystemLog 记录操作

### 4.3 通过 API 操作

```bash
# Preview 晋级
curl -X POST /admin/api/road/results/advance/preview \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"teamId": "...", "reachedStage": "TOP16"}'

# Confirm 晋级
curl -X POST /admin/api/road/results/advance \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"teamId": "...", "reachedStage": "TOP16"}'

# Preview 淘汰
curl -X POST /admin/api/road/results/eliminate/preview \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"teamId": "...", "eliminatedAtStage": "TOP32"}'

# Confirm 淘汰
curl -X POST /admin/api/road/results/eliminate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"teamId": "...", "eliminatedAtStage": "TOP32"}'
```

### 4.4 幂等保证

- 重复执行 advance：返回 `alreadySettled`，不重复迁移资金
- 重复执行 eliminate：返回 `alreadyEliminated`，不重复迁移资金

---

## 5. 手动结算池子

当池子需要提前关闭时：

```bash
curl -X POST /admin/api/road/pools/[POOL_ID]/close \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

注意：结算后池子状态变为 SETTLED，所有资金按规则迁移。

---

## 6. 费率配置

在 `RoadConfig` 页面配置动态费率参数：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| baseHouseFeeBps | 基础 house fee bps | 500 (5%) |
| maxHouseFeeBps | 最大 house fee bps | 1000 (10%) |
| baseDividendBps | 基础分红 bps | 3000 (30%) |
| prizeBps | 奖池 bps | 2000 (20%) |
| superBps | 超级池 bps | 500 (5%) |
| reinvestBps | 复投 bps | 500 (5%) |
| agentBps | 代理 bps | 500 (5%) |
| reserveBps | 储备池 bps | 500 (5%) |
| releaseDelayHours | 奖励释放延迟小时 | 72 |
| lowCoverageThresholdBps | 低覆盖率阈值 bps | 1000 (10%) |

---

## 7. KOL / 代理配置

在 `RoadKOL` 页面管理 KOL：

- 查看每个 KOL 的推荐码、被推荐用户数、购买量、待释放佣金、已释放佣金
- 佣金在用户购买时自动从 agentPart 生成
- 佣金遵循与玩家奖励相同的 releaseDelayHours 释放规则

---

## 8. 回滚和暂停

### 8.1 暂停 Road Purchase

可以通过关闭所有 OPEN 池子来暂停新购买：

1. 进入 `RoadPools` 页面
2. 逐个将池子状态改为 CLOSED

或者通过 Admin API：
```bash
curl -X PATCH /admin/api/road/pools/[POOL_ID] \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "CLOSED"}'
```

### 8.2 查看 SystemLog

所有 Road 操作都会记录在 SystemLog，可在 `Admin > Logs` 查看。

### 8.3 紧急回滚

如果发生严重错误需要回滚：
1. 切换 `ACTIVE_PAYMENT_GATEWAY=mock` 暂停真充值
2. 保留数据库快照（postgres_data volume）
3. 通过 Admin 手动调整数据

---

## 9. 运营检查清单

日常检查：
- [ ] `RoadOverview`：确认总购买、平台费、超级池、官方赞助成本健康
- [ ] `RoadLiability`：确认 pendingReward 不会超过 treasury reserve 覆盖
- [ ] `RoadTreasury > reconcile`：确认所有 bucket 对账无误
- [ ] `RoadSponsor`：确认剩余预算充足
- [ ] SystemLog：检查是否有异常操作记录

每周检查：
- [ ] `RoadKOL`：检查佣金释放情况
- [ ] `RoadConfig`：根据 treasury 健康度调整费率
