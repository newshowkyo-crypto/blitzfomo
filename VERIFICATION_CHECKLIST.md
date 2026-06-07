# 功能验证检查清单

**用途**: 部署后快速验证所有功能是否正常工作  
**预计时间**: 15-20 分钟  
**环境**: http://localhost:8081 (用户端) + http://localhost:5174 (Admin)

---

## 🚀 快速启动

```bash
# 1. 启动 Docker
docker-compose up -d

# 2. 初始化数据库（仅首次）
docker-compose exec api npx prisma db push
docker-compose exec api npx prisma db seed

# 3. 清除浏览器缓存
# Ctrl+Shift+Delete 或 Cmd+Shift+Delete

# 4. 访问应用
# 用户端: http://localhost:8081
# Admin: http://localhost:5174
```

---

## ✅ 前端功能验证

### 1. 首页加载
- [ ] 访问 http://localhost:8081
- [ ] 页面加载正常（无错误）
- [ ] 看到 8 个游戏卡片
- [ ] 金色品牌主题显示正确
- [ ] "打开后台管理" 按钮可见

**预期结果**: 首页完整显示，所有元素可见

---

### 2. 游戏页面
- [ ] 点击 "进入世界杯主赛场" 卡片
- [ ] 游戏页面加载正常
- [ ] 看到倒计时显示（例如 00:60）
- [ ] 看到奖池金额（例如 $42,500.80）
- [ ] 看到 "BUY IN FOR $50" 按钮

**预期结果**: 游戏页面完整加载，所有元素显示

---

### 3. 购买功能
- [ ] 点击 "BUY IN FOR $50" 按钮
- [ ] 看到成功提示（✅ 购买成功）
- [ ] 余额减少 50 BF
- [ ] 奖池增加约 40 BF
- [ ] 倒计时重置为 60 秒
- [ ] 活动记录中出现新的购买记录

**预期结果**: 购买成功，数据实时更新

---

### 4. 语言切换
- [ ] 找到语言切换按钮（右上角）
- [ ] 点击切换到中文 (CN)
- [ ] 页面文字切换为中文
- [ ] 再次点击切换回英文 (EN)
- [ ] 页面文字切换回英文

**预期结果**: 语言切换正常，文字实时更新

---

### 5. 响应式设计
- [ ] 按 F12 打开开发者工具
- [ ] 切换到手机视图 (iPhone 12)
- [ ] 页面在 480px 宽度内显示
- [ ] 没有横向滚动
- [ ] 所有按钮可点击

**预期结果**: 移动端显示正常，无横向溢出

---

## 🔐 Admin 后台验证

### 1. 登录
- [ ] 访问 http://localhost:5174
- [ ] 看到登录页面
- [ ] 输入用户名: `super_admin`
- [ ] 输入密码: `Admin@2026!`
- [ ] 点击登录按钮
- [ ] 成功登录，跳转到仪表盘

**预期结果**: 登录成功，显示 Admin 仪表盘

---

### 2. 仪表盘
- [ ] 看到 3 个统计卡片（用户数、充值额、当前轮次）
- [ ] 卡片显示彩色渐变背景
- [ ] 看到 "自动化护盘控制室" 部分
- [ ] 看到 2 个按钮：机器人触发、创建机器人账户
- [ ] 侧边栏显示 8 个菜单项

**预期结果**: 仪表盘完整加载，所有组件显示

---

### 3. 游戏配置
- [ ] 点击侧边栏 "⚙️ 游戏配置"
- [ ] 看到所有配置参数（倒计时、赢家分成、最低购买等）
- [ ] 修改一个参数（例如倒计时改为 90）
- [ ] 点击 "保存配置" 按钮
- [ ] 看到成功提示

**预期结果**: 配置可修改，保存成功

---

### 4. 用户管理
- [ ] 点击侧边栏 "👥 用户管理"
- [ ] 看到用户列表
- [ ] 列表显示用户 ID、昵称、余额等信息
- [ ] 可以冻结/解冻用户
- [ ] 可以调整用户余额

**预期结果**: 用户列表加载，操作可用

---

### 5. 提现审核
- [ ] 点击侧边栏 "💸 提现管理"
- [ ] 看到提现申请列表
- [ ] 如果有待审核申请，可以批准或拒绝
- [ ] 点击拒绝时，出现模态框输入原因
- [ ] 操作后列表自动刷新

**预期结果**: 提现管理页面工作正常

---

### 6. 订单管理
- [ ] 点击侧边栏 "💳 订单管理"
- [ ] 看到支付订单列表
- [ ] 可以按状态过滤（全部、待支付、已支付）
- [ ] 对于待支付订单，可以标记为已支付
- [ ] 列表显示订单 ID、用户、金额、状态等

**预期结果**: 订单管理页面工作正常

---

### 7. 风控配置
- [ ] 点击侧边栏 "🛡️ 风控配置"
- [ ] 看到 5 个配置项：
  - 最小购买次数
  - 冷却期（天）
  - 单日提现额度限制
  - IP 限流
  - 用户限流
- [ ] 修改一个参数
- [ ] 点击 "保存配置"
- [ ] 看到成功提示

**预期结果**: 风控配置可修改，保存成功

---

### 8. 多语言管理
- [ ] 点击侧边栏 "🌐 多语言"
- [ ] 看到左侧语言列表
- [ ] 点击一个语言（例如 EN）
- [ ] 右侧显示该语言的 JSON 内容
- [ ] 可以编辑 JSON 内容
- [ ] 点击 "保存语言包"
- [ ] 看到成功提示

**预期结果**: 多语言管理工作正常

---

### 9. 审计日志
- [ ] 点击侧边栏 "📋 审计日志"
- [ ] 看到操作日志列表
- [ ] 列表显示时间、管理员、操作、目标类型等
- [ ] 可以分页浏览
- [ ] 可以导出 CSV
- [ ] 点击 "查看" 可以展开详情

**预期结果**: 审计日志页面工作正常

---

### 10. 退出登录
- [ ] 点击侧边栏 "🚪 退出登录"
- [ ] 返回登录页面
- [ ] 可以重新登录

**预期结果**: 退出功能正常

---

## 🔄 API 端点验证

### 用户端 API

```bash
# 1. 获取游戏状态
curl http://localhost:3000/api/game/state

# 2. 获取用户信息
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/user/profile

# 3. 获取多语言包
curl http://localhost:3000/api/locales/en
curl http://localhost:3000/api/locales/zh
curl http://localhost:3000/api/locales/es

# 4. 获取最近购买记录
curl http://localhost:3000/api/game/recent-purchases

# 5. 获取赢家墙
curl http://localhost:3000/api/game/winner-wall
```

**预期结果**: 所有端点返回 200 OK 和正确的 JSON 数据

---

### Admin API

```bash
# 1. 获取仪表盘统计
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:3000/admin/api/dashboard/stats

# 2. 获取游戏配置
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:3000/admin/api/game-config

# 3. 获取用户列表
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:3000/admin/api/users

# 4. 获取提现申请
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:3000/admin/api/withdrawals

# 5. 获取支付订单
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:3000/admin/api/payments

# 6. 获取多语言列表
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:3000/admin/api/locales

# 7. 获取审计日志
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:3000/admin/api/audit-logs
```

**预期结果**: 所有端点返回 200 OK 和正确的 JSON 数据

---

## 🐛 常见问题排查

### 问题 1: 页面加载很慢
**解决方案**:
- 检查 Docker 容器是否都在运行: `docker-compose ps`
- 查看日志: `docker-compose logs api`
- 等待数据库初始化完成

### 问题 2: Admin 无法登录
**解决方案**:
- 确认用户名密码正确: `super_admin` / `Admin@2026!`
- 检查数据库是否初始化: `docker-compose exec api npx prisma db push`
- 查看 API 日志: `docker-compose logs api`

### 问题 3: 语言切换不工作
**解决方案**:
- 清除浏览器缓存: Ctrl+Shift+Delete
- 检查 locales 端点是否可访问: `curl http://localhost:3000/api/locales/en`
- 查看浏览器控制台错误 (F12)

### 问题 4: 购买按钮不工作
**解决方案**:
- 确认已登录
- 检查余额是否足够
- 查看浏览器控制台错误 (F12)
- 查看 API 日志: `docker-compose logs api`

### 问题 5: Admin 页面样式错乱
**解决方案**:
- 清除浏览器缓存: Ctrl+Shift+Delete
- 重新构建 Admin: `cd apps/admin && npm run build`
- 重启容器: `docker-compose restart admin`

---

## 📊 性能验证

### 响应时间
- [ ] 游戏状态查询 < 100ms
- [ ] 用户信息查询 < 100ms
- [ ] 购买操作 < 500ms
- [ ] Admin 列表加载 < 1s

### 并发性能
- [ ] 同时 10 个购买请求成功
- [ ] 同时 5 个 Admin 操作成功
- [ ] 没有数据不一致

### 内存使用
- [ ] API 容器内存 < 500MB
- [ ] Admin 容器内存 < 300MB
- [ ] 没有内存泄漏

---

## ✅ 最终检查清单

### 功能完整性
- [ ] 所有 8 个 Admin 页面都可访问
- [ ] 所有 API 端点都可调用
- [ ] 所有数据库操作都成功
- [ ] 所有权限控制都生效

### 代码质量
- [ ] 没有控制台错误
- [ ] 没有网络请求失败
- [ ] 没有数据库错误
- [ ] 没有内存泄漏

### UI/UX 质量
- [ ] 所有页面样式一致
- [ ] 所有按钮都可点击
- [ ] 所有表单都可提交
- [ ] 所有模态框都可关闭

### 安全性
- [ ] 登录需要正确凭证
- [ ] 操作需要正确权限
- [ ] 敏感数据已加密
- [ ] 没有 SQL 注入漏洞

---

## 🎉 验证完成

如果以上所有检查都通过，说明项目已完全就绪，可以：
1. ✅ 部署到测试环境
2. ✅ 进行用户验收测试 (UAT)
3. ✅ 部署到生产环境
4. ✅ 开始用户运营

**预计验证时间**: 15-20 分钟  
**验证人**: _______________  
**验证时间**: _______________  
**验证结果**: ✅ 通过 / ❌ 失败

---

**文档完成时间**: 2026-05-30 23:50 UTC+08:00
