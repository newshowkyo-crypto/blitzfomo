# Bot Operations Safe Mode

##上线结论
- 机器人可以自动运行，也可以在后台手动触发。
- 机器人只用于冷启动活跃度、UI 动态、压力测试和演示。
- 机器人购买会写入 `Purchase.isBot = true`，但不会扣真实余额、不会增加可兑付奖池、不会重置真人倒计时、不会替代真人最后买家。
- 真实 BF 闭环仍是：Plisio 入金 → 支付订单 PAID → BF 余额入账 → 真人购买扣 BF → 回合结算发奖 → 用户发起提现 → 后台审核。

##明确禁止改回
- 不要让机器人增加 `round.prizePool`。
- 不要让机器人写入 `round.lastBuyerUserId`。
- 不要让机器人产生真实提现或伪造已提现金额。
- 不要把展示统计改成固定假数。
- 不要绕过提现审核直接自动出款。

##后台操作
1. 进入后台机器人配置页。
2. 创建少量机器人账号。
3. 设置自动开关、最小/最大 BF、触发间隔。
4. 可点“手动触发一次”验证活动流。
5. 上线前建议关闭自动机器人，只保留手动触发用于巡检。

##已验证
- `npm run build --workspace apps/api`
- `npm run build --workspace apps/admin`
- `node scripts/full-functional-audit.js`
- 机器人专项：触发后奖池不变，最后买家不变。

##上线前仍需真人确认
- 用 Plisio 真实小额订单验证回调从 `PENDING` 变 `PAID`。
- 后台人工审核第一笔提现，确认链上转账和系统状态一致。
