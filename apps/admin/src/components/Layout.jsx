import { Link, useLocation } from 'react-router-dom'

export default function Layout({ children, onLogout }) {
  const location = useLocation()

  const navItems = [
    { path: '/', label: '仪表盘', icon: '📊' },
    { path: '/live-monitor', label: '实时监控', icon: '📡' },
    { path: '/road-overview', label: '冠军之路', icon: '🏆' },
    { path: '/road-teams', label: '球队管理', icon: '🧩' },
    { path: '/road-pools', label: '阶段池', icon: '🧱' },
    { path: '/road-results', label: '赛果录入', icon: '📝' },
    { path: '/road-sponsor', label: '官方赞助', icon: '🏷️' },
    { path: '/road-liability', label: '分红负债', icon: '📌' },
    { path: '/road-treasury', label: '总账对账', icon: '📚' },
    { path: '/road-config', label: 'Road配置', icon: '⚙️' },
    { path: '/road-kol', label: 'KOL/代理', icon: '🤝' },
    { path: '/config', label: '游戏配置', icon: '⚙️' },
    { path: '/users', label: '用户管理', icon: '👥' },
    { path: '/withdrawals', label: '提现管理', icon: '💸' },
    { path: '/payments', label: '订单管理', icon: '💳' },
    { path: '/rounds', label: '轮次历史', icon: '🏆' },
    { path: '/bot-config', label: '机器人配置', icon: '🤖' },
    { path: '/risk-config', label: '风控配置', icon: '🛡️' },
    { path: '/locales', label: '多语言', icon: '🌐' },
    { path: '/audit-logs', label: '审计日志', icon: '📋' },
    { path: '/system-logs', label: '系统日志', icon: '📝' },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-emerald-50/30 to-amber-50/30 overflow-hidden">
      {/* Sidebar */}
      <div className="hidden md:flex w-72 bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950 text-white flex-col shadow-2xl border-r border-slate-700/50">
        <div className="p-6 border-b border-slate-700/50">
          <div className="bg-gradient-to-r from-yellow-400 via-amber-500 to-emerald-500 rounded-2xl p-4 shadow-lg">
            <div className="text-2xl font-black tracking-tight text-white">⚡ BLITZ</div>
            <div className="text-xs text-white/90 font-semibold mt-1">WORLD CUP OPS</div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item, index) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm flex items-center gap-3 ${
                isActive(item.path)
                  ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-white border border-yellow-500/30 shadow-lg'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
              style={{ animationDelay: `${index * 25}ms` }}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {isActive(item.path) && (
                <span className="ml-auto w-2 h-2 bg-yellow-400 rounded-full"></span>
              )}
            </Link>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-700/50 space-y-3">
          <div className="bg-slate-800/50 rounded-xl p-3">
            <div className="text-xs text-slate-400 font-semibold">系统状态</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-xs text-green-400 font-semibold">运行正常</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">v2026.06.03</div>
          </div>
          <button
            onClick={onLogout}
            className="w-full px-4 py-3 bg-gradient-to-r from-red-600/20 to-red-700/20 hover:from-red-600/30 hover:to-red-700/30 text-red-300 hover:text-red-200 rounded-xl transition-all duration-200 font-semibold border border-red-500/30 flex items-center justify-center gap-2"
          >
            <span>🚪</span>
            <span>退出登录</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white/95 backdrop-blur-md shadow-sm px-4 md:px-8 py-4 border-b border-gray-100">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-gray-900 flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <span>Blitz Finale 管理后台</span>
              </h1>
              <p className="text-xs text-gray-500 mt-1">生产上线控制台 · 支付 / 提现 / 风控 / 多语言</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-xs text-gray-600 font-medium">系统在线</span>
              </div>
              <div className="bg-gradient-to-r from-slate-100 to-slate-50 border border-slate-200 rounded-full px-4 py-2">
                <span className="text-xs text-gray-600 font-mono">{new Date().toLocaleString('zh-CN')}</span>
              </div>
            </div>
          </div>
        </header>
        
        {/* Mobile Nav */}
        <div className="md:hidden bg-slate-950/95 backdrop-blur-md px-3 py-2 flex gap-2 overflow-x-auto border-b border-slate-700/50">
          {navItems.map(item => (
            <Link 
              key={item.path} 
              to={item.path} 
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive(item.path) 
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-lg' 
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              <span className="mr-1">{item.icon}</span>
            </Link>
          ))}
        </div>
        
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
