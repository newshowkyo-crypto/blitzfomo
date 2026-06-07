# DECISIONS.md — 重要技术决策记录（严格遵守 TDD + CODEX）

> 所有影响资金安全、扩展性、维护性的决策必须记录在此。

## 1. 资金模型（最高铁律，不可违反）

**决策**：
- 所有金额字段统一使用 `BigInt`（最小单位：1 = 0.01 BF/USDT）
- **任何余额变更必须且只能通过 `LedgerService.applyLedger()`**
- 同时写入不可变 `ledger` 表 + 更新 `users.balance`（balance 仅为 ledger 聚合视图）
- 严禁任何地方直接 UPDATE users.balance

**依据**：TDD 4.2、CODEX 约束规范第1条

## 2. 抢购原子性

**决策**：
- 奖池累加 + 倒计时重置 + lastBuyer 更新 **必须在单条 Redis Lua 脚本（purchase.lua）内原子完成**
- 应用层只做前置参数校验（minBuy、用户状态、风控）

**依据**：TDD 4.1、CODEX P2

## 3. 结算防重复

**决策**：
- Settlement Worker 使用 **Redlock** 获取分布式锁
- 锁 key = `settlement:round:{roundId}`
- 获取锁失败直接跳过

**依据**：TDD 4.1、CODEX 约束规范第2条

## 4. 配置管理（TDD 强调）

**决策**：
- game_config、risk_config 作为单例表（id=1）
- 启动时加载到 Redis Hash
- 后台修改后必须调用 `ConfigService.refreshAllConfigs()`
- 所有业务逻辑从 ConfigService 读取参数，严禁硬编码

**依据**：TDD 第0节 + 4.2

## 5. 支付网关策略

**决策**：
- 定义 `PaymentGateway` 接口（createOrder + verifyCallback + parseCallback）
- 默认实现 MockGateway（自动回调，便于联调）
- 通过 `game_config.activePaymentGateway` 控制当前激活网关
- 后台配置页可填真实网关参数（加密存储），保存后立即生效

**依据**：TDD 4.4、CODEX 前提第1条

## 6. 提现流程

**决策**：
- 状态机：REQUESTED → PENDING_REVIEW（风控通过）→ APPROVED → PAID（人工标记）
- 申请时立即通过 applyLedger 冻结余额
- 拒绝/失败自动退款（正向 ledger）

**依据**：TDD 4.3

## 7. 前端技术约束

**决策**：
- 用户端**严格只允许注入 app.js**，绝不修改 Stitch 生成的任何 HTML/CSS/结构
- 所有动态数据通过 document.getElementById / querySelector 填充

**依据**：CODEX 约束规范第4条 + UI_CONTRACT

## 8. 机器人与假数据隔离

**决策**：
- purchases.is_bot = true 的记录在结算时不真实发奖（奖池滚入下一轮）
- 假数据（activeFans、totalWithdrawn 等）仅在响应层叠加，不进入 ledger/rounds

**依据**：TDD 4.5

## 9. 其他
- Admin 所有写操作必须记录 admin_audit_log
- 使用 class-validator 做所有 DTO 校验
- 纯中心化，完全不上链（钱包地址仅用于签名登录）

**最后更新**：2026-05-30（第二波开发后）