# BlitzFomo World Cup 2026 Edition 接力说明

更新时间：2026-05-31

## 1. 项目目标

用户要赶在 2026 世界杯前上线一个 Telegram Mini App 游戏：

- 前台：移动端 TMA 游戏页，世界杯/足球主题，支持多语言。
- 后台：生产可用的运营后台，能管游戏参数、支付、提现、用户、机器人、风控、多语言、审计日志。
- 支付：当前只先接数字货币收款，已选 Plisio。上线前默认仍用 mock，真实小额测试后切换 Plisio。
- 部署：用户已有域名 `blitzfomo.com` 和 VPS，但目前先在本地开发完整，再一次性上 VPS/GitHub。

## 2. 技术栈/结构

- `apps/api`：NestJS API
- `apps/admin`：React + Vite 管理后台
- `web/index.html`：主 TMA 前台，内联 CSS/JS
- `prisma/schema.prisma`：数据库模型
- `docker-compose.yml`：本地一键起 Postgres/Redis/API/Admin/Nginx

## 3. 敏感信息注意

- `.env` 里已经保存用户提供的 Plisio API Key。
- 不要在聊天回复、文档、日志里重复输出 API Key。
- `.env.example` 只能放占位。
- 当前真实支付不要默认打开，等用户确认后再从后台把网关切到 `plisio`。

## 4. 已完成事项

### 前台 TMA

文件：

- `web/index.html`
- `web/media/world-cup-hero.png`
- `web/assets/world-cup-hero.png`

已做：

- 重做了世界杯风格 TMA UI。
- 加了主视觉图和足球场线视觉。
- 页面包括：
  - Arena / 主赛场
  - Live / 比赛中心
  - Leaderboard / 排行榜
  - Wallet / 钱包
  - Referral / 邀请
  - Profile / 我的
  - Edit Profile / 编辑资料
  - Rules / 规则
  - Bracket / 世界杯赛程
- 多语言框架已有：`en / zh / es / pt / fr / ar`。
- 接入了充值订单展示、打开 Plisio invoice、轮询支付状态。
- DOM 检查结果：
  - 9 个 view
  - 5 个底部导航
  - 无横向溢出
  - hero 图片加载正常
  - payment box 存在

### Plisio 支付

文件：

- `apps/api/src/payment/gateways/plisio.gateway.ts`
- `apps/api/src/payment/payment.service.ts`
- `apps/api/src/payment/payment.controller.ts`
- `apps/api/src/payment/payment-gateway.factory.ts`
- `apps/api/src/payment/payment.module.ts`

已做：

- 新增 Plisio gateway。
- 后台可切换 `mock / plisio`。
- 回调接口：
  - `POST /api/payment/webhook/plisio?json=true`
- 用户查询订单：
  - `GET /api/payment/:id`
- Plisio 成功状态：
  - `completed`
  - `mismatch`
- 失败状态：
  - `expired`
  - `cancelled`
  - `error`
- 入账金额使用数据库订单金额，避免回调篡改金额。

Plisio 后台要配置：

- Status URL：`https://blitzfomo.com/api/payment/webhook/plisio?json=true`
- Request IP：VPS 出口 IP，用户之后提供。

### 后台 Admin

主要文件：

- `apps/admin/src/App.jsx`
- `apps/admin/src/components/Layout.jsx`
- `apps/admin/src/pages/Dashboard.jsx`
- `apps/admin/src/pages/Payments.jsx`
- `apps/admin/src/pages/Withdrawals.jsx`
- `apps/admin/src/pages/Users.jsx`
- `apps/admin/src/pages/BotConfig.jsx`
- `apps/admin/src/pages/GameConfig.jsx`
- `apps/admin/src/pages/RiskConfig.jsx`
- `apps/admin/src/pages/Locales.jsx`
- `apps/admin/src/pages/AuditLogs.jsx`

已做：

- 后台整体视觉做了生产感精修，移动端也能用。
- 新增独立机器人配置页：
  - `apps/admin/src/pages/BotConfig.jsx`
- 菜单加入机器人配置：
  - `/bot-config`
- 仪表盘补了：
  - 总用户
  - 累计充值
  - 当前轮次
  - 今日充值
  - 今日提现
  - 今日净流入
  - 当前支付网关
  - 机器人状态
- 支付订单页补了：
  - 网关切换面板
  - `mock / plisio` 快速切换
  - 订单列表
  - 手动标记已支付
- 提现页补了：
  - 地址复制
  - 批准时填写打款备注/TxID
  - 表格横向滚动
- 用户页重做：
  - 用户列表
  - 用户详情弹层
  - 最近账本流水
  - 冻结/解冻
  - 手动调账

### API 修复

文件：

- `apps/api/src/admin/admin.service.ts`

已做：

- 仪表盘接口补今日充值/提现/净流入/待审提现/网关/机器人状态。
- 修复提现拒绝不退余额的重大财务风险：
  - 拒绝提现时写 `WITHDRAW_REFUND` ledger 退回余额。
- 机器人配置更新时，把金额字段转成 BigInt 最小单位。

### 文档/脚本

文件：

- `LOCAL_PRODUCTION_CHECKLIST.md`
- `scripts/local-smoke.ps1`
- `HANDOFF_FOR_NEXT_AGENT.md`

已做：

- 本地准生产检查清单。
- 本地 smoke 脚本：
  - nonce 登录
  - 创建充值订单
  - 查询支付状态
  - mock 下自动变 `PAID`

运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-smoke.ps1
```

## 5. 已验证

已通过：

```powershell
npm run build --workspace apps/api
npm run build --workspace apps/admin
node -e "const fs=require('fs'),vm=require('vm');const html=fs.readFileSync('web/index.html','utf8');const m=html.match(/<script>([\s\S]*)<\/script>/);new vm.Script(m[1]);console.log('web script ok')"
powershell -ExecutionPolicy Bypass -File scripts/local-smoke.ps1
```

结果：

- API build 通过
- Admin build 通过
- 前台脚本解析通过
- mock 充值 smoke 通过

### 5.1 最新全量 UI 巡检结果

巡检时间：2026-05-31 晚

已额外修复：

- `apps/admin/src/main.jsx`：`BrowserRouter` 已加 `basename="/admin"`，否则 `/admin/users` 等深链路会全部跳回仪表盘。
- `docker-compose.yml`：`admin` 服务已挂载 `./apps/admin/dist:/app/dist:ro`，以后本地执行 `npm run build --workspace apps/admin` 后，重启 admin/nginx 即可看到最新后台包。

巡检命令使用 Playwright 访问：

- `http://localhost:8081/`
- `http://localhost:8081/admin/`

前台结果：

| 页面 | 状态 | 横向溢出 | 破图 |
|---|---:|---:|---:|
| Arena | OK | 无 | 0 |
| Rank | OK | 无 | 0 |
| Wallet | OK | 无 | 0 |
| Invite | OK | 无 | 0 |
| Profile | OK | 无 | 0 |

后台结果：

| 路由 | 页面标题 | 状态 | 横向溢出 |
|---|---|---:|---:|
| `/admin/` | 运营监控中心 | OK | 无 |
| `/admin/users` | 用户管理 | OK | 无 |
| `/admin/payments` | 订单管理 | OK | 无 |
| `/admin/withdrawals` | 提现审核管理 | OK | 无 |
| `/admin/bot-config` | 机器人配置 | OK | 无 |
| `/admin/config` | 游戏与风控自动化控制台 | OK | 无 |
| `/admin/risk-config` | 风控配置 | OK | 无 |
| `/admin/locales` | 多语言管理 | OK | 无 |
| `/admin/audit-logs` | 操作审计日志 | OK | 无 |

生成的巡检截图：

- `audit-current-tma-mobile.png`
- `audit-current-admin-users.png`
- `audit-current-admin-bot.png`

注意：

- 重启 `api` 后如果 Nginx 出现 `502 Bad Gateway`，通常是容器 IP 变化，执行：

```powershell
docker compose restart nginx
```

再检查：

```powershell
Invoke-RestMethod http://localhost:8081/api/health
```

## 6. 下一批推荐苦力工作

DeepSeek 或其他模型可以优先做这些“便宜苦力活”：

### A. 后台 UI 继续统一

重点文件：

- `apps/admin/src/pages/GameConfig.jsx`
- `apps/admin/src/pages/RiskConfig.jsx`
- `apps/admin/src/pages/Payments.jsx`
- `apps/admin/src/pages/Locales.jsx`
- `apps/admin/src/pages/AuditLogs.jsx`

目标：

- 所有页面统一标题、说明、卡片、按钮、空态。
- 表格统一加 `overflow-x-auto`，避免小屏横向爆。
- 所有 loading / error / empty 状态统一。
- 所有危险操作加确认。
- 不要大改业务逻辑。

最新观察：

- 后台深链路已经修好，DeepSeek 可以直接访问 `/admin/users`、`/admin/payments` 等页面。
- `Dashboard / Users / Payments / Withdrawals / BotConfig` 已比较像生产后台。
- 还需要重点精修 `GameConfig / RiskConfig / Locales / AuditLogs`，这几个页面风格相对旧。

### B. 前台多语言补完整

文件：

- `web/index.html`

现状：

- 英文和中文比较完整。
- 西语/葡语/法语/阿语只有部分 key，会 fallback 到英文。

目标：

- 把 `I18N.es / pt / fr / ar` 补齐所有 key。
- 不要改 key 名。
- 阿语保留 RTL 支持。
- 注意不要破坏内联脚本语法。

最新观察：

- 前台 5 个底部主页面无横向溢出、无破图。
- 前台视觉已经足够接近世界杯主题。
- 低成本提升点是补全 `es / pt / fr / ar` 文案，而不是继续大改布局。

验证：

```powershell
node -e "const fs=require('fs'),vm=require('vm');const html=fs.readFileSync('web/index.html','utf8');const m=html.match(/<script>([\s\S]*)<\/script>/);new vm.Script(m[1]);console.log('web script ok')"
```

### C. Admin 多语言页增强

文件：

- `apps/admin/src/pages/Locales.jsx`

目标：

- JSON 编辑器旁边加“格式化 JSON”按钮。
- 保存前校验 JSON。
- 空语言时显示清楚说明。
- 不要引入新依赖。

### D. 支付页增强

文件：

- `apps/admin/src/pages/Payments.jsx`

目标：

- 增加订单状态统计卡片。
- 增加 `FAILED` filter。
- 长订单号支持复制。
- 网关切换区域加 Plisio status URL 提示：
  - `https://blitzfomo.com/api/payment/webhook/plisio?json=true`
- 不要展示 API Key。

### E. 提现状态机再检查

文件：

- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/withdraw/withdraw.service.ts`
- `apps/admin/src/pages/Withdrawals.jsx`

当前问题：

- Admin approve 目前直接把提现标为 `PAID`，这是为了快上线的人工打款模式。
- 如果要更严谨，可以改成：
  - 审核通过：`APPROVED`
  - 人工打款后：`PAID`

注意：

- 如果改状态机，要同步前端按钮和筛选。
- 不要破坏拒绝退余额。

### F. 本地截图验收

如果工具允许，用浏览器查看：

- `http://localhost:8081/`
- `http://localhost:8081/admin/`

后台默认账号：

- 用户名：`super_admin`
- 密码：`Admin@2026!`

建议检查：

- 前台是否无横向滚动
- 钱包充值按钮是否生成订单
- 后台支付页是否能看到 `mock / plisio`
- 后台机器人配置页是否能打开
- 用户详情弹层是否能打开

## 7. 不要做的事

- 不要把 `.env` 或 API Key 发到聊天里。
- 不要默认切到 Plisio 真实支付。
- 不要引入大型 UI 库或重构框架。
- 不要删除现有 Docker/Nginx 结构。
- 不要做合规规避、抗投诉规避类建议。
- 不要提交 git commit，除非用户明确要求。

## 8. 给后续模型的工作方式

用户很在意 token 成本，沟通要短：

- 先做事，再简短汇报。
- 每次只处理一批明确文件。
- 改完必须跑最小验证。
- 最终回复控制在 5-8 条 bullet。

推荐回复模板：

```text
我先接着做后台 UI 统一，不碰部署、不碰真实支付 key。
```

完成后：

```text
本批完成：
- 改了 xxx
- 补了 xxx
- 验证 xxx 通过
下一批建议：xxx
```
