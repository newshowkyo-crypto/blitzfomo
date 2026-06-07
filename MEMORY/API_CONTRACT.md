# API_CONTRACT.md — 接口契约（用户端 + Admin 端）

## 1. 响应格式

**用户端**：推荐扁平结构（兼容真实 HTML 直接使用）
**Admin 端**：统一 `{ code: 0, data, msg, requestId }`

## 2. 错误码（packages/shared/error-codes.ts 唯一来源）

见 error-codes.ts（40001 INSUFFICIENT_BALANCE、40002 ROUND_ENDED 等）

## 3. 用户端必实现接口

- GET  /api/auth/nonce
- POST /api/auth/verify
- GET  /api/game/state
- POST /api/game/purchase
- GET  /api/user/profile
- POST /api/payment/create
- POST /api/withdraw
- GET  /api/game/recent-purchases
- GET  /api/game/winner-wall
- GET  /api/locales/{lang}.json

## 4. Admin 端必实现接口（覆盖 PRD 9 大模块）

- Dashboard 统计
- GameConfig 读写 + 重置默认
- 用户管理 + 冻结 + 调余额（必须走 ledger）
- 支付订单列表 + 手动标记
- 提现审核（通过/拒绝/批量）
- 支付网关配置（加密 + 切换）
- 风控配置
- 机器人配置
- 多语言 CRUD
- 审计日志查询 + 导出

**最后更新**：2026-05-30