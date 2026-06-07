# Blitz Finale – World Cup 2026 Edition · 技术设计文档 (TDD)

版本: 1.0 ｜ 更新: 2026-05-30 ｜ 配套 PRD: v5.0

## 0. 关键产品参数（硬编码默认值，全部可经后台动态改）
| 参数 | 默认值 | 后台可改 |
|---|---|---|
| BF:USDT 兑换比例 | 1 : 1 | ✅ |
| 初始奖池 | 1000 BF | ✅ |
| 赢家分成 | 70% | ✅ |
| 平台抽成 | 30% | ✅ |
| 倒计时 | 60 秒 | ✅ |
| 最低购买 | 1 BF | ✅ |

> 设计原则：以上数值**禁止散落在代码里**，统一存于 `game_config` 单例表，启动时由 seed 写入默认值，运行时从 Redis 缓存读取，后台改动后即时刷新缓存。

## 1. 设计基调
- **纯中心化账本，完全不上链**。USDT 仅作为「面值单位」，提现走「标记/手动打款」流程，无任何链上交互、无私钥、无 RPC。
- 钱包地址仅作为登录身份标识（签名登录），不做真实转账。
- 聚合支付先用 **Mock 适配器**，后台可填入真实网关配置一键切换，不阻塞开发。

## 2. 技术栈
| 层 | 技术 |
|---|---|
| 后端 | Node.js 20 + TypeScript(strict) + NestJS |
| 实时 | Socket.IO（轮询降级） |
| DB | PostgreSQL 16 + Prisma |
| 缓存/原子/锁 | Redis 7（Lua + Redlock） |
| 异步任务 | BullMQ |
| 后台面板 | React 18 + Vite + Ant Design Pro |
| 用户端 | Stitch 静态 HTML + 注入式 app.js（禁改 DOM） |
| 鉴权 | 用户:签名登录→JWT；Admin:账密→JWT+RBAC |
| 部署 | Docker Compose (pg/redis/api/admin/nginx) |

## 3. 系统架构
浏览器(Stitch HTML) ─┐
├─Nginx─┬─ /api ─▶ NestJS API
React Admin SPA ─────┘ ├─ /admin/api ─▶ NestJS API(Admin)
├─ /socket.io ─▶ WS
└─ /admin ─▶ Admin 静态
NestJS ──▶ Postgres(真账/ledger) / Redis(原子结算/锁/缓存) / BullMQ(结算·机器人·提现)

## 4. 核心模块

### 4.1 抢购原子结算（核心难点）
- 「奖池累加 + 倒计时重置(60s) + 记录 lastBuyer」由 **单条 Redis Lua 脚本** 原子完成。
- Redis 维护 round_state: { roundId, prizePool, deadlineTs, lastBuyer, status }。
- 结算触发：settlement-worker 轮询 deadline，到点加 **Redlock** 后结算，防重复发奖。
- 结算事务(Postgres)：发赢家 70% → 记平台 30% → 写 ledger×N → 关闭旧 round → 开新 round(注入初始奖池配置) → 广播 `round:settled`。
purchase.lua (原子):
if now >= deadline -> return ROUND_ENDED
if amount < minBuy -> return BELOW_MIN_BUY // 也在应用层先校验
prizePool += amount
deadline = now + countdownSec
lastBuyer = userId
return {prizePool, deadline}

### 4.2 资金闭环（双账本，强一致）
- `ledger` 不可变流水；`users.balance` 为视图缓存。
- **铁律：任何余额变更必须写一条 ledger，balance_after 必须等于该用户最新累计**。Service 层封装 `applyLedger()` 唯一入口，禁止直接 update balance。
- 充值：Mock/真实网关回调 → 验签 → 幂等(paymentId 唯一) → applyLedger(recharge)。
- 提现：申请即冻结(扣可用余额, ledger withdraw 负记) → 状态机 → 拒绝则 applyLedger(refund) 退回。

### 4.3 提现状态机（纯中心化，无上链）
REQUESTED ─风控校验(购买次数≥N & 冷却已过 & 余额足)
├─不过→ REJECTED (退余额)
└─过 → PENDING_REVIEW
├─管理员拒绝→ REJECTED (退余额)
└─管理员通过→ APPROVED ─(标记打款/手动)→ PAID
└─失败→ FAILED (退余额)

### 4.4 支付适配器（可插拔，Mock 优先）
- 接口 `PaymentGateway { createOrder(); verifyCallback(); }`。
- 实现：`MockGateway`(默认，自动回调成功，便于联调) + `AggregatorGateway`(读 DB 配置)。
- 当前激活网关 = `game_config.active_gateway`（默认 mock）。后台支付配置页填入 apiKey/secret/callbackUrl/baseUrl(加密存储)，保存后切 `active_gateway` 即生效，**无需改代码、不阻塞开发**。

### 4.5 机器人 / 假数据
- 机器人购买：BullMQ 重复任务，受后台开关/频率/金额范围控制；机器人写 `purchases.is_bot=true`，**结算时若 lastBuyer 为机器人 → 不发真实奖（按配置奖池滚入下轮）**。
- 前端假数据（活跃球迷数 / 已提现总额 / 赢家墙伪造项）：仅在用户端响应层叠加 display-only 字段，**绝不写 ledger/rounds/真实结算**。

### 4.6 鉴权 RBAC
- 用户：`GET /api/auth/nonce?address=` → 前端签名 → `POST /api/auth/verify` → userJWT。
- Admin：账密(bcrypt)→ adminJWT；角色 super_admin / operator。
- operator 禁止：支付密钥配置、手动改余额、风控配置。所有 Admin 写操作落 `admin_audit_log`。

## 5. 数据库（核心表）
users / admins / rounds / purchases / ledger / payments / withdrawals / game_config(单例) / risk_config(单例) / locales / admin_audit_log / system_log。
（字段详见 Prisma schema，金额统一 bigint 最小单位，禁 float。）

## 6. 非功能约束
- 金额整数化：BF 以整数，USDT 以最小单位 bigint。
- 幂等：充值回调 / 提现打款 / 购买 均带幂等键(Redis SETNX)。
- 限流：Redis 滑动窗口，每 IP / 每用户。
- 可观测：pino 结构化日志 + /health。
- TS strict；共享 DTO 在 packages/shared。

## 7. 部署
`docker compose up` 一键起 pg/redis/api/admin/nginx；用户端与 /admin 可直接访问；seed 自动写默认参数与一个 super_admin。