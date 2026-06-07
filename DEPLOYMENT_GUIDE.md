# 快速部署指南

**最后更新**: 2026-05-30 23:20 UTC+08:00

---

## ⚡ 5 分钟快速启动

### 前置条件
```bash
✅ Docker & Docker Compose 已安装
✅ Node.js 20+ 已安装
✅ 端口 8081, 3000, 5174, 5434, 6381 未被占用
```

### 启动步骤

#### 1️⃣ 启动 Docker 容器
```bash
cd "BlitzFomo World Cup 2026 Edition"
docker-compose up -d
```

**等待输出**:
```
✅ blitz-postgres is healthy
✅ blitz-redis is healthy
✅ blitz-api is running
✅ blitz-admin is running
✅ blitz-nginx is running
```

#### 2️⃣ 初始化数据库（仅首次）
```bash
docker-compose exec api npx prisma db push
docker-compose exec api npx prisma db seed
```

#### 3️⃣ 访问应用

| 应用 | 地址 | 说明 |
|------|------|------|
| 🎮 用户端 | http://localhost:8081 | 游戏主页 |
| 📊 Admin 后台 | http://localhost:5174 | 管理面板 |
| 🔌 API | http://localhost:3000/api | 后端接口 |

---

## 🔑 默认凭证

### Admin 登录
```
用户名: super_admin
密码: Admin@2026!
```

### 演示账户
- 自动生成（首次访问时）
- 初始余额: 1000 BF

---

## 📋 完整端口映射

```
┌─────────────────────────────────────────────────────┐
│ 服务          │ 内部端口 │ 外部端口 │ 地址          │
├─────────────────────────────────────────────────────┤
│ PostgreSQL    │ 5432    │ 5434    │ localhost:5434 │
│ Redis         │ 6379    │ 6381    │ localhost:6381 │
│ API (NestJS)  │ 3000    │ 3000    │ localhost:3000 │
│ Admin (React) │ 5174    │ 5174    │ localhost:5174 │
│ Nginx         │ 80      │ 8081    │ localhost:8081 │
└─────────────────────────────────────────────────────┘
```

---

## 🧪 功能测试

### 1. 用户端测试

#### 访问首页
```
http://localhost:8081
```

**验证**:
- ✅ 页面加载正常
- ✅ 金色品牌主题显示
- ✅ 8 个游戏卡片可见
- ✅ "打开后台管理" 按钮可点击

#### 进入游戏
```
点击 "进入世界杯主赛场" 卡片
```

**验证**:
- ✅ 游戏页面加载
- ✅ 倒计时显示
- ✅ 奖池显示
- ✅ "BUY IN" 按钮可点击
- ✅ 浮窗语言切换显示

#### 购买测试
```
点击 "BUY IN FOR $50" 按钮
```

**验证**:
- ✅ 购买成功提示
- ✅ 余额更新
- ✅ 奖池增加
- ✅ 倒计时重置

### 2. Admin 后台测试

#### 登录
```
访问: http://localhost:5174
用户名: super_admin
密码: Admin@2026!
```

**验证**:
- ✅ 登录成功
- ✅ 侧边栏显示 8 个菜单项
- ✅ 仪表盘加载统计数据

#### 仪表盘
```
主页面自动显示
```

**验证**:
- ✅ 3 个统计卡片彩色显示
- ✅ 用户数、充值额、轮次显示正确
- ✅ 机器人控制按钮可用

#### 游戏配置
```
点击侧边栏 "⚙️ 游戏配置"
```

**验证**:
- ✅ 显示所有游戏参数
- ✅ 可修改倒计时、分成比例等
- ✅ 保存后立即生效

#### 用户管理
```
点击侧边栏 "👥 用户管理"
```

**验证**:
- ✅ 显示用户列表
- ✅ 可冻结/解冻用户
- ✅ 可调整用户余额

#### 提现管理
```
点击侧边栏 "💸 提现管理"
```

**验证**:
- ✅ 显示提现申请列表
- ✅ 可批准/拒绝提现
- ✅ 可添加审核备注

#### 其他功能
```
依次点击: 订单管理、风控配置、多语言、审计日志
```

**验证**:
- ✅ 所有页面加载正常
- ✅ 样式一致
- ✅ 功能可用

---

## 🐛 常见问题

### Q: 页面加载很慢
**A**: 
- 检查 Docker 容器是否都在运行: `docker-compose ps`
- 查看日志: `docker-compose logs api`
- 等待数据库初始化完成

### Q: 无法连接到 Admin
**A**:
- 确认端口 5174 未被占用: `netstat -an | grep 5174`
- 清除浏览器缓存: Ctrl+Shift+Delete
- 重启 Admin 容器: `docker-compose restart admin`

### Q: 购买按钮不工作
**A**:
- 检查是否登录了
- 查看浏览器控制台错误 (F12)
- 检查 API 日志: `docker-compose logs api`

### Q: Admin 登录失败
**A**:
- 确认用户名密码正确
- 检查数据库是否初始化: `docker-compose exec api npx prisma db push`
- 查看 API 日志

### Q: 数据库连接错误
**A**:
```bash
# 重置数据库
docker-compose down -v
docker-compose up -d
docker-compose exec api npx prisma db push
docker-compose exec api npx prisma db seed
```

---

## 📊 监控与日志

### 查看实时日志
```bash
# 所有服务
docker-compose logs -f

# 仅 API
docker-compose logs -f api

# 仅 Admin
docker-compose logs -f admin

# 仅数据库
docker-compose logs -f postgres
```

### 进入容器调试
```bash
# 进入 API 容器
docker-compose exec api sh

# 进入数据库
docker-compose exec postgres psql -U blitz -d blitz_finale

# 进入 Redis
docker-compose exec redis redis-cli -a blitz_redis_2026
```

### 数据库查询
```bash
# 查看用户
SELECT id, nickname, balance FROM "User" LIMIT 10;

# 查看轮次
SELECT id, "roundNumber", "prizePool", status FROM "Round" ORDER BY "createdAt" DESC LIMIT 5;

# 查看购买记录
SELECT u.nickname, p.amount, p."createdAt" FROM "Purchase" p 
JOIN "User" u ON p."userId" = u.id 
ORDER BY p."createdAt" DESC LIMIT 10;
```

---

## 🔄 重启与更新

### 重启所有服务
```bash
docker-compose restart
```

### 重启特定服务
```bash
docker-compose restart api
docker-compose restart admin
docker-compose restart postgres
```

### 完全重置（清除所有数据）
```bash
docker-compose down -v
docker-compose up -d
docker-compose exec api npx prisma db push
docker-compose exec api npx prisma db seed
```

### 更新代码后重新部署
```bash
# 1. 更新代码
git pull

# 2. 重新构建
docker-compose build

# 3. 重启
docker-compose up -d
```

---

## 🚀 生产部署建议

### 前置检查
- [ ] 修改所有默认密码
- [ ] 修改 JWT_SECRET
- [ ] 启用 HTTPS
- [ ] 配置防火墙
- [ ] 备份数据库
- [ ] 启用日志监控

### 环境变量
```bash
# .env 文件
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### 备份策略
```bash
# 每日备份数据库
docker-compose exec postgres pg_dump -U blitz blitz_finale > backup_$(date +%Y%m%d).sql

# 恢复备份
docker-compose exec -T postgres psql -U blitz blitz_finale < backup_20260530.sql
```

---

## 📞 技术支持

### 查看系统健康状态
```bash
curl http://localhost:3000/health
```

### 查看 API 文档
```
http://localhost:3000/api
```

### 查看数据库状态
```bash
docker-compose exec postgres pg_isready -U blitz -d blitz_finale
```

### 查看 Redis 状态
```bash
docker-compose exec redis redis-cli -a blitz_redis_2026 ping
```

---

## ✅ 部署检查清单

- [ ] Docker 容器全部运行
- [ ] 数据库初始化完成
- [ ] 首页可访问 (http://localhost:8081)
- [ ] Admin 可访问 (http://localhost:5174)
- [ ] 可以登录 Admin
- [ ] 可以进入游戏页面
- [ ] 可以购买
- [ ] 可以在 Admin 查看数据
- [ ] 没有控制台错误
- [ ] 日志显示正常运行

---

**祝部署顺利！** 🎉

如有问题，查看日志或联系技术支持。

