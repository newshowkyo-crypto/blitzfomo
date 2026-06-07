# UI_CONTRACT.md — 真实 Stitch HTML DOM 契约（P0 核心）

> **铁律**：用户端严禁修改任何 DOM、class、id。只能通过 `/app.js` 读取节点并填充数据、绑定事件。

## 1. 主游戏页面（已深度解析）

**来源**：`stitch_blitz_finale_world_cup_2026_edition/blitz_finale_world_cup_2026_edition/code.html`

### 关键动态节点（必须 API 驱动）

| ID/Selector                  | 含义                     | API 来源                  | 备注 |
|------------------------------|--------------------------|---------------------------|------|
| `#header-balance`            | 顶部余额                 | /api/user/profile         | 多处出现 |
| `#sidebar-balance`           | 侧边栏余额               | 同上                      | - |
| `#main-prize` / `#stat-pool` | 当前奖池                 | /api/game/state           | 大数字展示 |
| `#timer-display`             | 倒计时（MM:SS）          | /api/game/state + WS      | ≤10s 红色 pulse |
| `#timer-bar`                 | 倒计时进度条             | 同上                      | - |
| `#stat-fans`                 | Active Fans（可叠加假数据） | /api/game/state        | - |
| `#stat-withdrawn`            | Total Withdrawn          | 同上                      | - |
| `#activity-feed`             | 实时购买记录             | /api/game/recent-purchases + WS game:purchase | 最多保留10条 |
| `#winner-marquee`            | Winner Wall 跑马灯       | /api/game/winner-wall     | - |
| `#buy-button`                | 主购买按钮               | 点击后调 /api/game/purchase | 禁止前端本地改状态 |
| `#lang-picker`               | 语言切换（en/es/pt/tr/cn） | /api/locales/{lang}.json | - |
| `#winner-modal`              | 结算弹窗                 | round:settled 事件触发    | - |
| `#winner-name-display`       | 赢家昵称                 | 同上                      | - |
| `#win-amount`                | 中奖金额（70%）          | 同上                      | - |

### 购买行为约束
- 前端只负责发 POST `/api/game/purchase` { amount }
- 成功后**完全依赖**后端推送或轮询更新 UI
- 严禁前端本地修改 prizePool、timer、balance

## 2. 其他重要页面（待继续提取）

- wallet_blitz_finale/code.html
- withdraw_funds_blitz_finale + withdrawal_confirmation
- my_profile_blitz_finale
- leaderboard_*
- referral_*
- vip_*

**提取原则**：所有 data-i18n、需要动态填充的列表、表单字段、按钮事件。

## 3. 全局要求
- 多语言完全由 `/api/locales/{lang}.json` 驱动
- 假数据只在响应层叠加
- 实时性依赖 Socket.IO（game:state、game:purchase、round:settled）

**最后更新**：2026-05-30（基于真实 HTML 第一次 + 第二次扫描）