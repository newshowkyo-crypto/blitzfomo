# Blitz Finale - 快速开始指南

## 🚀 5 分钟快速启动

### 1. 环境准备
```bash
# 确保已安装
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16（或使用 Docker）
- Redis 7（或使用 Docker）
```

### 2. 启动服务
```bash
cd "BlitzFomo World Cup 2026 Edition"
docker-compose up -d
```

### 3. 初始化数据库
```bash
cd apps/api
npx prisma migrate deploy
npx prisma db seed
```

### 4. 访问应用
- **用户端**: http://localhost
- **Admin 后台**: http://localhost:5173
- **API**: http://localhost:3000/api

---

## 🔑 默认凭证

### Admin 登录
- **用户名**: super_admin
- **密码**: Admin@2026!

### 演示用户
- 自动生成（首次访问时）

---

## 📱 主要功能

### 用户端
| 功能 | 入口 | 说明 |
|------|------|------|
| 购买 | 主页按钮 | 参与抢购游戏 |
| 充值 | 浮窗菜单 | 充值 USDT（Mock） |
| 提现 | 浮窗菜单 | 申请提现 |
| 语言切换 | 浮窗菜单 | 支持 zh/en/es |
| 个人资料 | 侧边栏 | 查看余额和历史 |

### Admin 后台
| 页面 | 路径 | 功能 |
|------|------|------|
| 仪表盘 | `/` | 统计数据、快速操作 |
| 游戏配置 | `/config` | 倒计时、分成、最低购买等 |
| 用户管理 | `/users` | 列表、冻结、余额调整 |
| 提现审核 | `/withdrawals` | 批准/拒绝提现 |
| 订单管理 | `/payments` | 标记已支付 |
| 风控配置 | `/risk-config` | 购买次数、冷却期、限流 |
| 多语言 | `/locales` | 编辑语言包 |
| 审计日志 | `/audit-logs` | 操作日志、导出 CSV |

---

## 🔌 API 快速参考

### 游戏 API
```bash
# 获取游戏状态
curl http://localhost:3000/api/game/state

# 购买
curl -X POST http://localhost:3000/api/game/purchase \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50, "idempotencyKey": "uuid"}'

# 最近购买
curl http://localhost:3000/api/game/recent-purchases

# 赢家墙
curl http://localhost:3000/api/game/winner-wall
```

### 用户 API
```bash
# 获取资料
curl http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer <token>"

# 充值
curl -X POST http://localhost:3000/api/payment/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amountUsdt": 100}'

# 提现
curl -X POST http://localhost:3000/api/withdraw \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amountUsdt": 50, "toAddress": "0x...", "chain": "TON"}'
```

### 多语言 API
```bash
# 获取中文语言包
curl http://localhost:3000/api/locales/zh

# 获取英文语言包
curl http://localhost:3000/api/locales/en

# 获取西班牙文语言包
curl http://localhost:3000/api/locales/es
```

### Admin API
```bash
# 登录
curl -X POST http://localhost:3000/admin/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "super_admin", "password": "Admin@2026!"}'

# 获取仪表盘统计
curl http://localhost:3000/admin/api/dashboard/stats \
  -H "Authorization: Bearer <admin_token>"

# 获取游戏配置
curl http://localhost:3000/admin/api/config/game \
  -H "Authorization: Bearer <admin_token>"

# 更新游戏配置
curl -X PUT http://localhost:3000/admin/api/config/game \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"countdownSeconds": 60, "winnerPercent": 70}'
```

---

## 🧪 测试流程

### 1. 用户注册与登录
```bash
# 访问 http://localhost
# 自动生成演示账户
# 获得初始 1000 BF
```

### 2. 游戏体验
```bash
# 点击 "Buy In" 按钮
# 选择金额（最低 1 BF）
# 观看倒计时和奖池更新
```

### 3. 充值与提现
```bash
# 点击浮窗 "充值" 按钮
# 输入金额（Mock 支付自动完成）
# 点击浮窗 "提现" 按钮
# 输入金额和地址
# 在 Admin 后台审核
```

### 4. Admin 管理
```bash
# 访问 http://localhost:5173
# 用 super_admin / Admin@2026! 登录
# 浏览各个管理页面
# 修改游戏配置
# 审核提现申请
# 编辑多语言内容
```

---

## 🐛 常见问题

### Q: 如何重置数据库？
```bash
cd apps/api
npx prisma migrate reset
npx prisma db seed
```

### Q: 如何查看日志？
```bash
# API 日志
docker logs blitz-api

# Admin 日志
docker logs blitz-admin

# 数据库日志
docker logs blitz-postgres
```

### Q: 如何修改游戏参数？
1. 登录 Admin 后台
2. 进入 "游戏配置" 页面
3. 修改参数
4. 点击 "保存配置"
5. 立即生效

### Q: 如何添加新语言？
1. 登录 Admin 后台
2. 进入 "多语言" 页面
3. 创建新语言（编辑 JSON）
4. 保存
5. 前端自动加载

### Q: 如何查看审计日志？
1. 登录 Admin 后台
2. 进入 "审计日志" 页面
3. 查看所有操作记录
4. 可导出 CSV

---

## 📊 系统架构

```
┌─────────────────┐
│  用户端 (Web)   │
│  - Stitch HTML  │
│  - app.js 注入  │
└────────┬────────┘
         │
    ┌────▼────┐
    │  Nginx  │
    └────┬────┘
         │
    ┌────┴─────────────────┐
    │                      │
┌───▼────┐          ┌─────▼──────┐
│ API    │          │ Admin SPA   │
│ :3000  │          │ :5173       │
└───┬────┘          └─────┬──────┘
    │                     │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │   NestJS Backend    │
    │  - Game Logic       │
    │  - Auth & RBAC      │
    │  - Ledger & Settle  │
    └──────────┬──────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────┐          ┌─────▼──────┐
│PostgreSQL          │   Redis    │
│ - 账本             │ - 原子操作 │
│ - 配置             │ - 缓存     │
│ - 日志             │ - 锁       │
└────────┘          └────────────┘
```

---

## 🔐 安全建议

### 生产部署前
- [ ] 修改 Admin 默认密码
- [ ] 修改 JWT_SECRET
- [ ] 启用 HTTPS
- [ ] 配置防火墙
- [ ] 备份数据库
- [ ] 启用日志监控
- [ ] 配置告警规则

### 定期维护
- [ ] 检查审计日志
- [ ] 更新依赖包
- [ ] 备份数据库
- [ ] 监控系统性能
- [ ] 检查错误日志

---

## 📞 技术支持

### 查看日志
```bash
# 实时日志
docker-compose logs -f api

# 查看特定容器
docker-compose logs postgres
docker-compose logs redis
```

### 健康检查
```bash
curl http://localhost:3000/health
# 返回: {"status":"ok"}
```

### 数据库连接
```bash
# 进入 PostgreSQL
docker-compose exec postgres psql -U blitz -d blitz_db

# 查看表
\dt

# 查询用户
SELECT * FROM "User" LIMIT 5;
```

---

## 📚 文档导航

- **GAP_ANALYSIS.md** - 全量功能对标分析
- **FIXES_APPLIED.md** - 修复总结和验证清单
- **PROJECT_STATUS.md** - 项目最终状态报告
- **Blitz Finale PRD v5.0** - 产品需求文档
- **TDD.md** - 技术设计文档

---

## ✨ 核心特性

✅ **原子购买** - Redis Lua 脚本保证数据一致性  
✅ **双账本** - Ledger 流水 + Balance 缓存  
✅ **分布式锁** - Redlock 防重复发奖  
✅ **动态多语言** - 后台实时编辑，前端动态加载  
✅ **完整 RBAC** - 角色权限分离  
✅ **审计日志** - 所有操作完整记录  
✅ **响应式设计** - 移动端 + PC 完美适配  
✅ **离线保护** - CDN 失败不影响体验  

---

**祝您使用愉快！** 🎉

