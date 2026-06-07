# Road to Champion Launch Checklist

版本：v1.0
日期：2026-06-02
适用范围：Blitz Finale V3 Road to Champion 上线前验收

---

## 1. 基础检查

### 1.1 环境

- [ ] `NODE_ENV=production`
- [ ] `ACTIVE_PAYMENT_GATEWAY` 不是 `mock`
- [ ] `JWT_SECRET` 已配置（不能是默认值）
- [ ] `ADMIN_PASSWORD` 已配置（不能是默认值）
- [ ] `OPERATOR_PASSWORD` 已配置
- [ ] `PLISIO_API_KEY` 已配置且有效
- [ ] `PUBLIC_API_BASE_URL` 已配置为生产域名
- [ ] `TMA_PUBLIC_URL` 已配置为生产域名

### 1.2 数据库

- [ ] 生产环境运行 `prisma migrate deploy`（不是 `db push`）
- [ ] 数据库迁移无错误
- [ ] seed 数据已正确导入

### 1.3 构建

```bash
npm run build --workspace apps/api
npm run build --workspace apps/admin
```

- [ ] API 构建成功
- [ ] Admin 构建成功
- [ ] Docker 镜像构建成功

### 1.4 Docker Compose

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
```

- [ ] 配置验证通过

---

## 2. Road 核心功能

### 2.1 球队和池子

- [ ] 有活跃球队（RoadTeams 页面可见）
- [ ] 有 OPEN 状态的池子（RoadPools 页面可见）
- [ ] 池子有正确的 basePrice 和 sponsorBudgetLimit

### 2.2 购买流程

- [ ] 前台首页显示 Super Champion Jackpot
- [ ] 前台显示阶段 Tab（TOP32/TOP16/QUARTER/SEMI/FINAL/CHAMPION）
- [ ] 前台显示球队路线卡（team flag/name/stage/price/sold keys/prize pool）
- [ ] 点击购买按钮打开购买弹窗
- [ ] 购买弹窗显示当前价格和资金分配摘要
- [ ] 购买弹窗显示风险提示（route can be eliminated）
- [ ] 购买后 Feed 显示新购买记录
- [ ] 重复购买幂等（idempotencyKey）

### 2.3 Official Sponsor

- [ ] 全局 Sponsor 预算已配置（RoadSponsor 页面）
- [ ] 单池 Sponsor 限制已设置
- [ ] Sponsor 注入后正确写入 SponsorLedger 和 treasury
- [ ] 超全局预算时拒绝注入
- [ ] 超单池限制时拒绝注入
- [ ] 重复 reference 不扣预算、不重复加池子

### 2.4 晋级/淘汰

- [ ] Preview 晋级返回预计资金迁移、影响池子、持有人数量
- [ ] Preview 淘汰返回 future pools 关闭情况
- [ ] Confirm 必须二次确认才能执行
- [ ] 重复晋级返回 alreadySettled，不重复迁移资金
- [ ] 重复淘汰返回 alreadyEliminated，不重复迁移资金
- [ ] SystemLog 记录 preview 和 confirm 操作

### 2.5 奖励释放

- [ ] 购买后 pendingReward 正确记录
- [ ] releaseDelayHours 后奖励自动释放（可通过加速测试验证）
- [ ] pendingReward 不能提现
- [ ] releasedReward 可以提现
- [ ] Bot 的 pendingReward 在检测到后取消并转入 reserve

---

## 3. Treasury 对账

### 3.1 Reconcile API

```bash
curl -X GET /admin/api/road/treasury/reconcile \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

- [ ] 返回 ok=true
- [ ] poolPrizeDiff = 0
- [ ] pendingRewardDiff = 0
- [ ] superJackpotDiff = 0
- [ ] 无 orphan records

### 3.2 Bucket 验证

- [ ] houseFee bucket 金额正确（来自购买和赞助）
- [ ] poolPrize bucket 金额正确（来自购买、赞助、晋级分配）
- [ ] pendingReward bucket = sum of all holdings.pendingReward
- [ ] superJackpot bucket = superJackpot 表 amount
- [ ] reserve bucket > pendingReward bucket * 50%（储备覆盖率健康）

### 3.3 verify-road-v3 测试

```bash
node scripts/verify-road-v3.js
```

所有测试必须通过：
- [ ] ROAD_PURCHASE
- [ ] ROAD_DIVIDEND_AFTER_LATER_BUY
- [ ] ROAD_PENDING_NOT_WITHDRAWABLE
- [ ] ROAD_BOT_CANNOT_BUY
- [ ] ROAD_SPONSOR_IDEMPOTENT
- [ ] ROAD_SPONSOR_REFERENCE_IDEMPOTENT
- [ ] ROAD_SPONSOR_GLOBAL_BUDGET_CAP
- [ ] ROAD_SPONSOR_POOL_LIMIT_CAP
- [ ] ROAD_CLOSED_POOL_NO_BUY
- [ ] ROAD_ADVANCE_IDEMPOTENT
- [ ] ROAD_REFERRAL_COMMISSION_CREATED
- [ ] ROAD_ELIMINATE_IDEMPOTENT
- [ ] ROAD_ELIMINATE_CLOSE_FUTURE_POOLS
- [ ] ROAD_TREASURY_RECONCILE_OK

---

## 4. 前台 UI

### 4.1 首页

- [ ] 标题显示 "Road to Champion" 或 "世界杯冠军之路"
- [ ] Super Champion Jackpot 显示正确
- [ ] Official Sponsored 总额显示
- [ ] Total Real Purchases 显示
- [ ] Pending Rewards Paid 显示
- [ ] 阶段 Tab 切换正常
- [ ] 球队路线卡显示正确信息（flag/name/stage/price/keys/prize/dividends）
- [ ] Sponsored 标记（🏛️ Official Sponsored badge）正确显示
- [ ] 状态标记（LIVE/SETTLED/CLOSED）正确显示
- [ ] Buy 按钮在 OPEN 池子上显示

### 4.2 购买弹窗

- [ ] 弹窗显示 Pool 信息（team/stage/status）
- [ ] 当前价格显示
- [ ] 奖池金额显示
- [ ] Amount 输入框
- [ ] 快速加额按钮（+10/+50/+100/+500）工作正常
- [ ] 风险提示显示
- [ ] 购买成功后弹窗关闭，数据刷新

### 4.3 我的页面

- [ ] My Road Keys 面板显示
- [ ] Pending（待释放）显示正确
- [ ] Released（已释放）显示正确
- [ ] 持仓列表显示每条记录（team/stage/keys/avg price/pending/released）

### 4.4 Live Feed

- [ ] 显示最新购买和赞助事件
- [ ] Official Sponsored 标记正确
- [ ] 自动刷新

### 4.5 多语言

- [ ] 语言切换按钮存在
- [ ] 英文文案正确
- [ ] 中文文案正确

---

## 5. 后台 UI

### 5.1 RoadOverview

- [ ] 总购买金额
- [ ] 平台费收入
- [ ] 超级冠军池余额
- [ ] 官方赞助总成本
- [ ] 待释放负债
- [ ] 储备覆盖率

### 5.2 RoadTeams

- [ ] 球队列表
- [ ] 创建球队
- [ ] 编辑球队（状态、阶段）
- [ ] 球队状态正确显示

### 5.3 RoadPools

- [ ] 池子列表
- [ ] 创建池子（team/stage/basePrice/sponsorLimit）
- [ ] 编辑池子
- [ ] 池子状态正确显示

### 5.4 RoadResults

- [ ] Preview 晋级功能正常
- [ ] Confirm 晋级功能正常
- [ ] Preview 淘汰功能正常
- [ ] Confirm 淘汰功能正常
- [ ] 操作记录在 SystemLog 可查

### 5.5 RoadSponsor

- [ ] 全局总预算/已用/剩余显示
- [ ] 单池 sponsor limit 显示
- [ ] sponsor reference 显示
- [ ] 注入 sponsor 功能正常

### 5.6 RoadLiability

- [ ] pendingReward 总负债
- [ ] releasedReward 总负债
- [ ] reserve 覆盖率

### 5.7 RoadTreasury

- [ ] bucket 明细
- [ ] 按事件查询
- [ ] reconcile 入口

### 5.8 RoadConfig

- [ ] 费率配置可编辑
- [ ] 分红配置可编辑
- [ ] 释放延迟配置可编辑
- [ ] 低覆盖率阈值可配置

### 5.9 RoadKOL

- [ ] KOL 列表
- [ ] KOL code
- [ ] 被推荐用户数
- [ ] 购买量
- [ ] 待释放佣金
- [ ] 已释放佣金

---

## 6. 安全检查

### 6.1 Bot 防护

- [ ] Bot 用户无法购买 Road Key（verify: ROAD_BOT_CANNOT_BUY）
- [ ] Bot 的 pendingReward 被正确取消

### 6.2 幂等性

- [ ] 重复购买不重复扣款
- [ ] 重复晋级不重复迁移资金
- [ ] 重复淘汰不重复迁移资金
- [ ] 重复 sponsor reference 不重复扣预算

### 6.3 权限

- [ ] 非 admin 无法访问 `/admin/api/road/*`
- [ ] 非 admin 无法创建/编辑球队、池子
- [ ] 非 admin 无法执行晋级/淘汰
- [ ] 普通玩家无法访问 `/admin/*`

### 6.4 支付安全

- [ ] Plisio 回调验证通过
- [ ] 金额使用数据库订单金额，不使用回调金额
- [ ] 提现申请进入审核

---

## 7. 截图产出

上线前需产出截图：

```bash
# 启动开发服务器后截图
# Mobile 390px
audit-output/road-mobile-home.png
audit-output/road-mobile-buy-modal.png
audit-output/road-mobile-my.png

# Desktop
audit-output/road-desktop-home.png
```

截图要求：
- 390px 宽 Mobile 视图必须不溢出
- 世界杯深色金色风格
- Road 冠军之路路线图视觉
- 球队卡显示完整信息
- 超级池大卡醒目展示

---

## 8. 最终验收

在完成以上所有检查项后，执行最终验证：

```bash
node scripts/verify-road-v3.js
```

所有测试必须 PASS 才能上线。

上线决策：
- [ ] 所有核心功能测试通过
- [ ] Treasury 对账通过
- [ ] UI 截图产出完成
- [ ] 文档已更新
- [ ] 运营团队已培训
- [ ] 应急回滚方案已确认
