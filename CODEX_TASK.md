# CODEX 开发任务书 — Blitz Finale World Cup 2026 Edition

> 本文件是 Codex 的唯一权威指令。请严格、完整、无阻塞地执行至成品。

## ★ 已确认前提（无需再问，直接照做）
1. **聚合支付先用 Mock 适配器**实现，后台支付配置页可填入真实网关参数并一键切换激活，不得因网关未定而阻塞任何开发。Mock 网关创建订单后自动模拟回调成功，便于全链路联调。
2. **纯中心化设计，完全不上链**：无任何区块链交互、无私钥、无 RPC、无真实转账。USDT 仅为面值单位，提现走「标记/手动打款」。钱包地址仅用于签名登录身份。
3. **默认参数（写入 game_config 种子，全部后台可改，禁止硬编码散落）**：
   - BF:USDT = 1:1
   - 初始奖池 = 1000 BF
   - 赢家 70% / 平台 30%
   - 倒计时 60 秒
   - 最低购买 1 BF
4. 遇到上述以外、确实需要外部资料/密钥的，先用 mock/沙箱跑通并记入 `MEMORY/OPEN_ISSUES.md`，**继续往下开发，不得停等**。

---

## A. 执行协议（最高优先级）
- 工作根目录：`F:\BlitzFomo World Cup 2026 Edition`
- 你是全自动全栈开发代理，**从零到成品一次性循环开发完毕**。中途所有技术问题（依赖、编译、报错、逻辑 bug、测试失败）**一律自行解决后继续**。
- **唯一允许暂停的情况**：必须由人类提供的外部真实资料/密钥或人类物理操作。其余禁止停下等待。当前阶段（用 mock）不存在此类阻塞，因此应一路开发到底。

## B. 🧠 记忆留存机制（强制，防止"开发久了忘记前面"）
在根目录维护 `MEMORY/` 目录，**每完成一个子任务立即更新并 git commit**：
1. `MEMORY/PROGRESS.md` — 进度账本（任务勾选 [x]/[ ]，标注当前任务）。
2. `MEMORY/DECISIONS.md` — 技术决策与原因、命名约定。
3. `MEMORY/UI_CONTRACT.md` — 从 Stitch HTML 提取的 DOM 契约。
4. `MEMORY/API_CONTRACT.md` — 已实现接口的最终字段定义。
5. `MEMORY/OPEN_ISSUES.md` — 待人工/待补资料事项。
6. `MEMORY/SESSION_HANDOFF.md` — 每次工作结束写：当前阶段、下一步、已知坑、如何继续。

**硬纪律：**
- 每次开始工作的第一个动作 = 读取 `MEMORY/` 全部文件恢复上下文，禁止凭空重启。
- 每完成一步 = 回写对应记忆文件 + `git commit`。

## C. 第一步必做：解析真实 UI（禁止跳过）
1. 扫描 `stitch_blitz_finale_world_cup_edition/` 下全部 .html/.css/.js。
2. 写入 `MEMORY/UI_CONTRACT.md`：所有 id、class、data-i18n key、需动态填充的节点、按钮事件、表单字段、所有页面入口。
3. 用户端**严禁改 DOM 结构与样式类名**，只能新增 `<script src="/app.js">` 注入逻辑。
4. 若真实 HTML 字段与本 TASK 示例不一致，**以真实 HTML 为准**，API 层适配并更新 `API_CONTRACT.md`。

## D. 仓库结构（创建之）
/apps/api NestJS 后端
/apps/admin React + Vite + AntD Pro 后台
/web Stitch HTML + 注入的 app.js
/packages/shared 共享 TS 类型(DTO/枚举/错误码)
/prisma schema + migrations + seed
/docker docker-compose.yml, nginx.conf, Dockerfile.*
/MEMORY 持久记忆
README.md TDD.md CODEX_TASK.md

---

## 📐 API 规范（强制统一）

### 1. 响应包络
- Admin 接口统一：`{ "code":0, "data":{...}, "msg":"ok", "requestId":"uuid" }`，失败 `code≠0, data:null, msg:错误码`。
- 用户端接口：**以真实 HTML 期望结构为准**。若 HTML 直接读扁平字段（如 PRD 示例 `{prizePool,countdown,...}`），用户端就返回扁平结构以兼容。两套约定写入 `API_CONTRACT.md`。

### 2. 路由
- 用户端 `/api/...`；后台 `/admin/api/...`；WS `/socket.io`，事件 `game:state`、`game:purchase`、`round:settled`。

### 3. 鉴权
- 用户：`GET /api/auth/nonce?address=` → 签名 → `POST /api/auth/verify` → Bearer userJWT。
- Admin：`POST /admin/api/auth/login` → Bearer adminJWT；守卫校验角色。

### 4. 错误码（放 packages/shared，禁魔法字符串）
| code | 含义 |
|---|---|
|0|成功|
|40001|INSUFFICIENT_BALANCE|
|40002|ROUND_ENDED|
|40003|BELOW_MIN_BUY|
|40101|UNAUTHORIZED|
|40301|FORBIDDEN|
|40901|DUPLICATE_REQUEST|
|42201|WITHDRAW_RISK_BLOCKED|
|42901|RATE_LIMITED|
|50000|INTERNAL_ERROR|

### 5. 用户端必实现接口（字段按真实 UI 校正）
- `GET  /api/game/state`
- `POST /api/game/purchase` {amount}
- `GET  /api/user/profile`
- `POST /api/payment/create` {amount_usdt, chain}
- `POST /api/payment/callback`（Mock 自动触发，含验签+幂等）
- `POST /api/withdraw` {amount_usdt, address}
- `GET  /api/game/recent-purchases?limit=`
- `GET  /api/game/winner-wall?limit=`
- `GET  /api/locales/{lang}.json`
- `GET  /api/auth/nonce` / `POST /api/auth/verify`

### 6. Admin 必实现接口（覆盖 PRD 5.1–5.9 全部）
仪表盘统计；game_config 读写（一键应用 / 恢复默认）；用户 CRUD/冻结/调余额；订单列表/手动标记支付；提现审核（通过/拒绝/批量小额）；机器人配置 + 手动触发一次；风控配置；多语言 CRUD + 设默认；支付网关配置（加密存储 + 切换激活网关）；审计日志 / 系统日志查询 + CSV 导出。**每个写接口必须落 admin_audit_log。**

### 7. 接口约束
- 所有写接口 DTO + class-validator，非法入参 422。
- 金额一律服务端校验，**绝不信任前端**。
- 充值回调 / 提现打款 / 购买带幂等键(Redis SETNX)。
- 分页统一 `page,pageSize`，返回 `total`。

---

## 🔒 约束规范（CONSTRAINTS，全程不可违反）
1. **资金安全**：禁 float；金额整数最小单位；任何余额变更必须经唯一入口 `applyLedger()` 同时写 ledger，否则视为 bug 必修。
2. **原子结算**：购买+倒计时重置经 Redis Lua 单脚本原子完成；结算加 Redlock 防重复发奖。
3. **机器人/假数据隔离**：机器人不进真实发奖；假数据仅响应层叠加，绝不污染 ledger/rounds。
4. **不改 DOM**：用户端仅注入 app.js。
5. **RBAC**：operator 禁止支付密钥配置 / 手动改余额 / 风控配置。
6. **幂等 + 限流**：全实装。
7. **类型安全**：TS strict；共享 DTO 放 packages/shared，前后端复用，禁重复定义。
8. **测试门槛**：资金/结算/购买核心逻辑必须有单测 + 至少 1 条 E2E（登录→充值→购买→结算→提现）。**测试全绿才算阶段完成。**
9. **可运行交付**：根目录 `docker compose up` 一键启动全部服务，用户端与 /admin 均可访问。
10. **安全**：网关密钥加密存储；JWT 过期；密码 bcrypt；全走 Prisma 防注入；CORS 白名单。
11. **每步提交**：每完成一个可验证单元 `git commit` 并更新 MEMORY。
12. **参数不硬编码**：所有产品数值从 game_config/risk_config 读取，默认值仅在 seed 中。

---

## 🗺 开发阶段（写入 PROGRESS.md 作为任务清单）
- **P0** 解析 UI→UI_CONTRACT；初始化 monorepo、Docker、Prisma schema、seed（默认参数+super_admin）。
- **P1** 基础设施：配置模块、迁移、Redis、统一响应/异常过滤器、鉴权骨架、health。
- **P2** 用户端核心：签名登录、game/state、purchase(Lua 原子)、settlement-worker、WebSocket、profile。
- **P3** 资金：payment/create + Mock 回调、ledger、withdraw 状态机、风控校验。
- **P4** 前端对接：注入 app.js，按 UI_CONTRACT 填充全部动态数据、多语言、轮询/WS。
- **P5** Admin 后端：全部 Admin API + RBAC + 审计日志 + 支付网关可切换。
- **P6** Admin 面板：React+AntD Pro 实现 9 大模块全部页面。
- **P7** 机器人/假数据：BullMQ 机器人任务、假数据注入层、后台开关联动。
- **P8** 加固：限流、验证码开关、幂等、冷启动、异常处理、E2E。
- **P9** 验收：全链路回归 + docker 一键起验证 + README + ACCEPTANCE.md。

## 🔁 主循环（Codex 持续执行直至成品）
LOOP:

1.读取 MEMORY/ 全部文件恢复上下文
2.从 PROGRESS.md 取第一个未完成 [ ] 任务
3.实现（代码+测试）
4.lint + build + 相关测试
失败 -> 自行排错修复 -> 回到 3 直到全绿
5.git commit + 更新 PROGRESS/DECISIONS/API_CONTRACT/HANDOFF
6.若 P0–P9 全完成 -> 跑全量 E2E 回归 -> 写 ACCEPTANCE.md -> 结束
否则 -> 回到 1
（仅当遇到"必须人工提供资料"才写 OPEN_ISSUES.md 并明确告知，否则不得停）
## ✅ 最终验收（自检全过才算成品）
- [ ] `docker compose up` 一键起，Stitch 用户端 + /admin 可访问。
- [ ] 抢购→倒计时归零→自动结算→赢家到账 全链路正确，并发无重复发奖。
- [ ] 充值/提现资金闭环正确，ledger 与余额一致。
- [ ] 提现状态机、风控、限流、幂等全部生效。
- [ ] Admin 9 大模块可用，RBAC 限制敏感操作，写操作有审计。
- [ ] 支付网关默认 Mock，可在后台填真实参数一键切换。
- [ ] 机器人/假数据受后台开关控制且不污染真实账目。
- [ ] 多语言切换正常，前端动态数据全由 API 驱动。
- [ ] 所有测试绿；MEMORY/ 完整；ACCEPTANCE.md 生成。
- [ ] 全程纯中心化、未引入任何上链/链上交互代码。