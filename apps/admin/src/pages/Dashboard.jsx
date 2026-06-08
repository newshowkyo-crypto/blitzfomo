import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminFetch } from '../lib/api'

export default function Dashboard({ token }) {
  const [stats, setStats] = useState(null)
  const [recentRounds, setRecentRounds] = useState([])
  const [trendData, setTrendData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [operating, setOperating] = useState(false)
  const [refreshIndicator, setRefreshIndicator] = useState(false)

  const fetchStats = async () => {
    setRefreshIndicator(true)
    try {
      const [statsRes, roundsRes, trendRes] = await Promise.all([
        adminFetch('/admin/api/dashboard/stats'),
        adminFetch('/admin/api/rounds?page=1&pageSize=10'),
        adminFetch('/admin/api/dashboard/trend?days=7')
      ])
      if (!statsRes.ok) return
      const data = await statsRes.json()
      const roundsData = await roundsRes.json()
      const trend = await trendRes.json()

      setStats(data)
      setRecentRounds(roundsData.items || [])
      setTrendData(trend)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshIndicator(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const timer = setInterval(fetchStats, 5000)
    return () => clearInterval(timer)
  }, [token])

  const handleTriggerBot = async () => {
    setOperating(true)
    try {
      const res = await adminFetch('/admin/api/config/bot/trigger-once', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (res.ok) {
        alert('✅ 机器人指令下发成功！一个随机球迷机器人将立即进行买入护盘。')
        fetchStats()
      } else {
        alert('❌ 触发失败，请确保您是 SUPER_ADMIN 权限')
      }
    } catch (e) {
      alert('网络错误')
    }
    setOperating(false)
  }

  const handleCreateBots = async () => {
    setOperating(true)
    try {
      const res = await adminFetch('/admin/api/config/bot/create-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10 })
      })
      if (res.ok) {
        alert('✅ 成功自动创建 10 个全新的世界杯狂热球迷机器人用户！并已生成其测试交易流水。')
        fetchStats()
      } else {
        alert('❌ 创建失败')
      }
    } catch (e) {
      alert('网络错误')
    }
    setOperating(false)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">加载中...</p>
        </div>
      </div>
    )
  }

  const statCards = [
    { icon: '👥', title: '总注册用户', value: stats?.totalUsers || 0, sub: '包含真实用户与机器人', palette: 'from-blue-50 to-blue-100 border-blue-200 text-blue-900', trend: null },
    { icon: '💰', title: '累计充值', value: `$${stats?.totalRecharged?.toFixed(2) || '0.00'}`, sub: '已确认 PAID 的总额', palette: 'from-green-50 to-green-100 border-green-200 text-green-900', trend: null },
    { icon: '🏆', title: '当前轮次', value: `#${stats?.currentRound?.roundNumber || '1'}`, sub: `奖池 ${(stats?.currentRound?.prizePool || 0).toFixed(2)} BF`, palette: 'from-amber-50 to-amber-100 border-amber-200 text-amber-900', trend: null },
    { icon: '📥', title: '今日充值', value: `$${stats?.todayRecharged?.toFixed(2) || '0.00'}`, sub: '今日入金表现', palette: 'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-900', trend: null },
    { icon: '📤', title: '今日提现', value: `$${stats?.todayWithdrawn?.toFixed(2) || '0.00'}`, sub: `待审 ${stats?.pendingWithdrawals || 0} 笔`, palette: 'from-rose-50 to-rose-100 border-rose-200 text-rose-900', trend: null },
    { icon: '⚡', title: '净流入', value: `$${stats?.todayNetInflow?.toFixed(2) || '0.00'}`, sub: `支付通道 ${stats?.activePaymentGateway || 'mock'} · 机器人${stats?.botEnabled ? '开' : '关'}`, palette: 'from-slate-50 to-slate-100 border-slate-200 text-slate-900', trend: null },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <span>📊</span>
            <span>运营监控中心</span>
            {refreshIndicator && (
              <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
            )}
          </h2>
          <p className="text-sm text-gray-500 mt-1">实时游戏数据与运营控制</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-xs text-green-700 font-bold">自动刷新 · 每 5 秒</span>
          </div>
          <button
            onClick={fetchStats}
            className="bg-white border border-gray-200 hover:bg-gray-50 rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-medium text-gray-700 transition-all"
          >
            <span>🔄</span>
            <span className="hidden md:inline">刷新数据</span>
          </button>
        </div>
      </div>
      
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {statCards.map((card, index) => (
          <div 
            key={card.title}
            className={`bg-gradient-to-br ${card.palette} p-6 rounded-2xl shadow-sm border hover:shadow-lg transition-all duration-300`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black uppercase tracking-widest opacity-70">{card.title}</div>
                <div className="text-3xl md:text-4xl font-black mt-2 truncate">{card.value}</div>
                <p className="text-xs mt-2 opacity-75">{card.sub}</p>
              </div>
              <div className="text-4xl md:text-5xl opacity-80">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Control Room */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 md:p-8 rounded-2xl shadow-xl border border-slate-700/50 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-3xl">🎮</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-white">自动化护盘控制室</h3>
            <p className="text-xs text-gray-400 mt-1">手动干预机器人，模拟高并发粉丝入场</p>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <p className="text-sm text-gray-300 leading-relaxed">
            <span className="font-bold text-amber-400">⚠️ 仅限 SUPER_ADMIN:</span> 在这里可以手动触发机器人购买或批量创建测试账户，用于演示高并发场景和冷启动保护。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleTriggerBot}
            disabled={operating}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold px-6 py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-2xl">🤖</span>
            <div className="text-left">
              <div className="text-base">立即触发机器人买入</div>
              <div className="text-xs opacity-80">一次性护盘操作</div>
            </div>
          </button>

          <button
            onClick={handleCreateBots}
            disabled={operating}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold px-6 py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-2xl">➕</span>
            <div className="text-left">
              <div className="text-base">批量创建 10 个机器人</div>
              <div className="text-xs opacity-80">生成测试账户</div>
            </div>
          </button>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        {trendData && trendData.days && trendData.days.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-gray-900">📈 近7天充值/提现趋势</h3>
                  <p className="text-xs text-gray-500 mt-1">每日充值与提现统计</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {trendData.days.map((day, idx) => {
                const maxValue = Math.max(...trendData.days.map(d => Math.max(d.recharged || 0, d.withdrawn || 0)))
                const rechargedWidth = maxValue > 0 ? ((day.recharged || 0) / maxValue * 100) : 0
                const withdrawnWidth = maxValue > 0 ? ((day.withdrawn || 0) / maxValue * 100) : 0

                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-gray-700">{day.date}</span>
                      <div className="flex gap-4 text-xs">
                        <span className="text-green-600 font-medium">充值: ${(day.recharged || 0).toFixed(2)}</span>
                        <span className="text-red-500 font-medium">提现: ${(day.withdrawn || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-700 ease-out"
                          style={{ width: `${rechargedWidth}%` }}
                        />
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-700 ease-out"
                          style={{ width: `${withdrawnWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recent Rounds */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900">🏆 最近轮次</h3>
                <p className="text-xs text-gray-500 mt-1">最新结算轮次记录</p>
              </div>
              <Link
                to="/rounds"
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white text-sm font-bold rounded-lg transition-all shadow-sm"
              >
                查看全部 →
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">轮次</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">赢家</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">奖池</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">结算时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentRounds.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center">
                      <div className="text-4xl mb-2">📭</div>
                      <div className="text-gray-500 text-sm">暂无轮次记录</div>
                    </td>
                  </tr>
                ) : (
                  recentRounds.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900">#{r.roundNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {r.winnerNickname || r.winner?.nickname || '-'}
                          </span>
                          {r.winner?.isBot && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">🤖</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-green-600">
                          ${((r.prizePool || 0) / 100).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {r.settledAt ? new Date(r.settledAt).toLocaleString('zh-CN') : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
