# Blitz Finale V3 PRD - Road to Champion

版本：v3.0  
日期：2026-06-02  
定位：世界杯冠军之路 FOMO Key 池  
目标：在保留现有支付、提现、后台、风控框架的基础上，把当前「最后一脚」玩法改造成更强世界杯情绪、更强复投、更低庄家亏损风险的中心化运营版本。

## 1. 核心一句话

玩家购买球队在不同晋级阶段的 Road Key，买得早价格低并可吃后续买入分红；球队晋级则解锁下一阶段和奖励，球队淘汰则后续路线失效，资金按规则滚入幸存池与世界杯超级冠军池。

## 2. 为什么替换当前玩法

当前 60 秒最后买家模式的问题：

- 最后一脚会变成脚本战争，普通玩家天然不信任。
- 跟世界杯关系弱，只是足球皮肤。
- 初始奖池过高时平台亏损风险大。
- 非最后玩家缺少持续收益理由。
- KOL 不好讲故事，代理也缺少强话术。

V3 改为「冠军之路」后：

- 世界杯赛制本身就是玩法。
- 强队稳但贵，弱队便宜但爆发高。
- 早进玩家能看到后续分红跳动。
- 晋级、淘汰、封盘、复投都能触发用户回访。
- 平台收入先扣，奖励全部来自净池，避免庄家被奖池打穿。

## 3. 游戏对象

### 3.1 Team

世界杯球队。后台可配置：

- 球队名称、国旗、分组、实力系数。
- 当前状态：未开赛、存活、晋级、淘汰。
- 当前阶段：小组赛、32 强、16 强、8 强、4 强、决赛、冠军。

### 3.2 Stage

Road Key 阶段：

- Top32：进入 32 强。
- Top16：进入 16 强。
- Top8：进入 8 强。
- Top4：进入 4 强。
- Final：进入决赛。
- Champion：获得冠军。

注意：2026 世界杯为 48 队，存在 32 强阶段，不应直接写 16 强。

### 3.3 Road Key

每个池唯一标识为：

```text
Pool(team, stage)
```

例如：

- Brazil.Top32
- Brazil.Top4
- Japan.Champion
- Argentina.Final

每个池独立定价、独立分红、独立封盘、独立结算。

## 4. 玩家流程

1. 进入首页，看到「世界杯超级冠军池」、热门球队路线、当前开放阶段。
2. 选择球队和阶段，例如 `Brazil Champion Key`。
3. 页面展示当前 Key 单价、已售数量、分红已发放、封盘时间、风险等级。
4. 玩家用 BF 购买 Key。
5. 后续有人买同队同阶段 Key，早期持有人获得实时待释放分红。
6. 球队晋级后，命中阶段 Key 获得阶段奖励和下一阶段折扣。
7. 球队淘汰后，该队后续路线关闭，未结算资金按规则滚入超级池、幸存池、储备池。
8. 玩家可将待释放收益复投下一阶段，获得释放加速或额外折扣。

## 5. 早期刺激设计

第一个买的人不能空等，必须有即时刺激：

- 创世 Key：每个 Pool 前 N 个购买者获得 `Genesis` 标记。
- 创世权重：Genesis Key 的分红权重为普通 Key 的 `1.2x-1.8x`，后台可配。
- 官方赞助池：平台可向 Pool 注入真实官方启动资金，显示为 `Official Sponsored Pool`。
- 首购返利：进入待释放 BF，不直接秒提，可复投或按规则释放。
- 首页榜单：展示「创世持有人」「热门路线」「分红跳动」。

禁止把官方赞助伪装成真人充值、真人购买、真人提现。

## 6. 官方赞助与机器人

### 6.1 官方赞助池

用途：

- 给冷启动池子一个可见金额。
- 给早期用户信心。
- 不作为平台无限垫付承诺。

规则：

- 后台可给每个 Pool 设置 `sponsorBudget`。
- 赞助资金进入奖池或分红预算，但不获得 Key、不参与分红、不参与提现。
- 页面必须标记为官方赞助，不混同用户真实资金。
- 每日/每池有预算上限。

### 6.2 机器人

允许：

- 弹幕、赛程提醒、房间热度、KOL 房间引导。
- 官方活动提醒，例如「巴西冠军池进入高热」。
- 模拟观众氛围，不参与资金收益。

禁止：

- 假充值。
- 假提现。
- 假赢家。
- 机器人中奖。
- 机器人拿分红。
- 机器人伪装真实用户购买影响真实 Key 收益。

如果一定要做冷启动交易节奏，只能做「Official Market Maker / 官方做市」并明确标记，且资金来自真实官方预算。

## 7. 资金分配模型

每笔购买金额为 `A`。

先扣平台动态稳定费：

```text
HouseFee = A * h
Net = A - HouseFee
```

`Net` 再进入：

```text
CurrentPrizePool = Net * p
DividendPool     = Net * d
SuperPool        = Net * s
ReinvestPool     = Net * r
AgentPool        = Net * k
ReservePool      = Net * z
```

约束：

```text
p + d + s + r + k + z = 1
```

冷启动建议：

```text
h = 0.05 - 0.08
p = 0.32
d = 0.28
s = 0.15
r = 0.10
k = 0.10
z = 0.05
```

正常期建议：

```text
h = 0.08 - 0.15
p = 0.30 - 0.38
d = 0.18 - 0.30
s = 0.10 - 0.20
r = 0.05 - 0.12
k = 0.08 - 0.12
z = 0.05 - 0.10
```

核心原则：平台先扣费，所有奖励只来自真实 Net，不承诺固定收益。

## 8. Key 定价模型

每个 Pool 使用独立动态曲线：

```text
Price(team, stage, t, sold)
= Base(stage)
* TeamStrength(team)
* SurvivalFactor(team, stage)
* DemandCurve(sold)
* TimePressure(t)
* PoolHeat(team, stage)
* ShockFactor(team)
```

### 8.1 Base(stage)

阶段越容易命中，基础价越高；越远期，基础价越低。

建议初始值：

```text
Top32    = 5.00 BF
Top16    = 4.00 BF
Top8     = 2.80 BF
Top4     = 1.80 BF
Final    = 1.20 BF
Champion = 0.80 BF
```

### 8.2 TeamStrength(team)

强队更贵，弱队更便宜。

```text
热门强队：1.30 - 1.80
中游球队：0.80 - 1.20
弱队冷门：0.30 - 0.80
```

### 8.3 SurvivalFactor

用后台概率或体育数据概率估算：

```text
SurvivalFactor = clamp(1 / impliedProbability, min, max)
```

为了不让价格失控，必须设置上下限。

### 8.4 DemandCurve

用 bonding curve：

```text
DemandCurve = (1 + soldKeys / L) ^ alpha
```

- `L`：流动性深度。
- `alpha`：涨价斜率。
- 强队 alpha 高，弱队 alpha 低。

建议：

```text
强队热门阶段 alpha = 1.35 - 1.80
中游球队 alpha     = 1.15 - 1.45
弱队冷门 alpha     = 1.05 - 1.25
```

### 8.5 TimePressure

越接近封盘，价格越高：

```text
TimePressure = 1 + gamma * (1 - timeLeft / totalOpenTime) ^ eta
```

建议：

```text
gamma = 0.15 - 0.60
eta   = 1.5 - 3.0
```

### 8.6 ShockFactor

根据赛果/晋级形势手动或自动调整：

- 赢球或晋级：远期 Key 上调。
- 输球但未淘汰：远期 Key 下调或风险提示。
- 淘汰：关闭全部后续 Pool。
- 爆冷晋级：后续 Key 价格上调但保留高波动标签。

第一版推荐：后台手动录入赛果，系统自动触发 ShockFactor 与开关池。

## 9. 分红模型

后进购买产生的 `DividendPool` 分给此前同 Pool 持有人。

用户权重：

```text
Weight_i = KeyAmount_i * AgeBoost_i * GenesisBoost_i * EntryDiscountBoost_i
```

其中：

```text
AgeBoost = min(1 + beta * ln(1 + holdingHours), AgeBoostCap)
GenesisBoost = 1.0 - 1.8
EntryDiscountBoost = clamp(CurrentPrice / EntryPrice, 1.0, 2.0)
```

单个用户分红：

```text
Dividend_i = DividendPool * Weight_i / Sum(Weight_all)
```

分红进入 `pendingRewardBalance`，不直接进入可提现余额。

## 10. 分红安全约束

动态分红率：

```text
d = d_base * GrowthFactor * SolvencyFactor * StageFactor
```

```text
GrowthFactor = clamp(Volume24h / AvgVolume72h, 0.75, 1.25)
SolvencyFactor = clamp(ReservePool / PendingRewardLiability, 0.50, 1.00)
StageFactor:
Top32    = 0.75
Top16    = 0.85
Top8     = 1.00
Top4     = 1.10
Final    = 1.20
Champion = 1.25
```

如果储备覆盖率不足：

- 自动降低新买入分红率。
- 延长待释放周期。
- 暂停官方赞助继续注入。
- 提高动态稳定费。

## 11. 晋级与淘汰资金流

### 11.1 晋级

球队完成某阶段目标：

```text
CurrentStagePrizePool
-> 55% 分给命中该阶段 Key 持有人
-> 25% 滚入该队下一阶段 Pool
-> 10% 世界杯超级冠军池
-> 5% 储备池
-> 5% 平台
```

持有人获得下一阶段折扣券：

```text
discount = 5% - 20%
validWindow = 30 minutes - 12 hours
```

### 11.2 淘汰

球队淘汰：

```text
UnresolvedFuturePools
-> 45% 世界杯超级冠军池
-> 25% 幸存球队公共池
-> 15% 储备池
-> 10% 平台
-> 5% KOL/活动预算
```

已发放分红不追回。

## 12. 提现与释放

余额分三类：

- `cashBalance`：充值本金/可用 BF。
- `pendingRewardBalance`：分红、奖励、返利待释放。
- `withdrawableBalance`：已释放可提现余额。

释放规则：

- 分红奖励默认 `24-72 小时` 线性释放。
- 复投下一阶段可加速释放。
- 大额提现人工审核。
- 可配置每日提现上限、最低提现额、手续费。
- 必须有真实提现证明墙，不能展示假提现。

## 13. KOL / 代理机制

KOL 推广对象：

- 某球队路线池。
- 某阶段池。
- 某冷门路线。
- 专属房间链接。

佣金来源：

- 仅来自 `AgentPool`。
- 按真实购买流水结算。
- 不从用户奖池额外扣。

建议：

```text
普通代理：8% - 12% of AgentPool allocation
核心 KOL：15% - 25% of AgentPool allocation
二级代理：上级佣金的 10% 以内
```

可设置首购奖励，但必须进入待释放余额。

## 14. UI 改造

### 14.1 首页

标题改为：

```text
Blitz Finale - Road to Champion
世界杯冠军之路
```

核心模块：

- 世界杯超级冠军池大卡片。
- 当前热门路线：巴西冠军、日本 8 强、阿根廷决赛等。
- 阶段 Tab：32 强 / 16 强 / 8 强 / 4 强 / 决赛 / 冠军。
- 球队路线卡：国旗、阶段、当前 Key 价格、已售、池子、分红已发、封盘倒计时。
- 实时分红滚动条：展示真实分红事件。
- 创世 Key 榜单。
- 官方赞助标识。

### 14.2 购买弹窗

展示：

- 当前价格。
- 预计获得 Key 数量。
- 当前池分配。
- 分红规则摘要。
- 风险提示：球队淘汰后后续路线关闭。
- 是否使用折扣券/待释放收益复投。

### 14.3 我的页面

展示：

- 持有 Key。
- 存活路线。
- 待释放收益。
- 可提现余额。
- 复投入口。
- KOL 邀请收益。

### 14.4 后台

新增：

- 球队管理。
- 阶段池管理。
- 赛果/晋级录入。
- Key 曲线参数。
- 官方赞助预算。
- 动态稳定费。
- 分红负债和储备覆盖率。
- KOL/代理配置。
- 提现释放规则。

## 15. 盈利模型

平台收入：

```text
Profit =
TotalPurchases * h
+ PromotionCarry
+ EliminatedPoolCarry
+ ReserveSurplus
- SponsorBudgetUsed
- PaymentFees
- InfraCost
- ManualCompensation
```

核心盈利点：

- 动态稳定费先扣，理论上每笔购买都有毛利。
- 淘汰池沉淀增加超级池与平台/储备收入。
- KOL 佣金从 AgentPool 出，不额外穿透平台本金。
- 官方赞助有预算上限，不能无限垫。

平台亏损风险来自：

- 官方赞助过高。
- 初期动态费过低且 KOL 成本过高。
- 释放规则过松导致挤兑。
- 手动错误结算。
- 假数据破坏信任引发集中提现。

## 16. 上线优先级

P0：

- Team / Stage / Pool。
- Key 购买与独立定价曲线。
- 同 Pool 后进分红。
- 晋级/淘汰后台录入。
- 官方赞助池。
- 超级冠军池。
- 待释放余额。
- 后台曲线参数。

P1：

- KOL/代理账本。
- 折扣券与复投加速。
- 创世 Key 榜单。
- 真实提现证明墙。

P2：

- 自动体育数据 API。
- 多语言精修。
- 高级风控评分。
- KOL 房间模板。

## 17. 推荐落地策略

第一版不要接自动体育 API。使用：

- 手动录入赛果。
- 自动重算价格。
- 自动开关后续 Pool。
- 人工复核结算预览。

原因：

- 更快上线。
- 避免 API 异常、时区、点球、排名规则造成事故。
- 后台人工确认更适合早期中心化运营。

