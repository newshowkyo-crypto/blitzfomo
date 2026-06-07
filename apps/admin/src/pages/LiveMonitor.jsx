import React, { useState, useEffect } from 'react'
import { adminFetch } from '../lib/api'

export default function LiveMonitor({ token }) {
  const [gameState, setGameState] = useState(null)
  const [recentPurchases, setRecentPurchases] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [stateRes, purchasesRes, statsRes] = await Promise.all([
        adminFetch('/admin/api/game/state'),
        adminFetch('/admin/api/game/recent-purchases?limit=20'),
        adminFetch('/admin/api/dashboard/stats')
      ])
      if (!stateRes.ok || !purchasesRes.ok || !statsRes.ok) return
      const state = await stateRes.json()
      const purchases = await purchasesRes.json()
      const statsData = await statsRes.json()

      setGameState(state)
      setRecentPurchases(Array.isArray(purchases) ? purchases : [])
      setStats(statsData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 2000) // 2秒刷新
    return () => clearInterval(timer)
  }, [token])

  if (loading) return <div className="text-center py-8 text-gray-500">⏳ 加载中...</div>

  const countdown = gameState?.countdown || 0
  const countdownMax = gameState?.countdownMax || 60
  const countdownPercent = Math.max(0, Math.min(100, (countdown / countdownMax) * 100))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-gray-900">📡 实时监控</h2>
          <p className="text-sm text-gray-500 mt-1">游戏状态、倒计时和实时购买流</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 font-semibold">🔄 自动刷新</div>
          <div className="text-sm text-green-600 font-bold">每 2 秒更新</div>
        </div>
      </div>

      {/* 游戏状态大屏 */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 rounded-3xl shadow-2xl p-8 text-white">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 奖池 */}
          <div className="text-center">
            <div className="text-sm font-bold text-blue-200 mb-2">💰 当前奖池</div>
            <div className="text-5xl font-black text-yellow-300">
              ${(gameState?.prizePool || 0).toFixed(2)}
            </div>
            <div className="text-xs text-blue-200 mt-2">BF</div>
          </div>

          {/* 倒计时 */}
          <div className="text-center">
            <div className="text-sm font-bold text-blue-200 mb-2">⏱️ 倒计时</div>
            <div className="text-5xl font-black text-white">
              {Math.floor(countdown / 60).toString().padStart(2, '0')}:{(countdown % 60).toString().padStart(2, '0')}
            </div>
            <div className="mt-4 h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-1000"
                style={{ width: `${countdownPercent}%` }}
              />
            </div>
          </div>

          {/* 轮次 */}
          <div className="text-center">
            <div className="text-sm font-bold text-blue-200 mb-2">🏆 当前轮次</div>
            <div className="text-5xl font-black text-emerald-300">
              #{gameState?.roundNumber || 1}
            </div>
            <div className="text-xs text-blue-200 mt-2">
              {gameState?.gameActive ? '🟢 进行中' : '🔴 等待中'}
            </div>
          </div>
        </div>

        {/* 最后买家 */}
        <div className="mt-8 pt-8 border-t border-white/20">
          <div className="text-center">
            <div className="text-sm font-bold text-blue-200 mb-2">👤 最后买家</div>
            <div className="text-2xl font-black text-white">
              {gameState?.lastBuyer || '等待首次购买'}
            </div>
          </div>
        </div>
      </div>

      {/* 实时统计 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
          <div className="text-xs font-bold text-gray-500 mb-1">👥 在线用户</div>
          <div className="text-2xl font-black text-gray-900">{stats?.onlineUsers || 0}</div>
          <div className="text-xs text-gray-500 mt-1">注册用户数</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-green-200 p-5">
          <div className="text-xs font-bold text-green-700 mb-1">📈 今日购买</div>
          <div className="text-2xl font-black text-green-600">{stats?.todayPurchases || 0}</div>
          <div className="text-xs text-green-600 mt-1">笔</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-blue-200 p-5">
          <div className="text-xs font-bold text-blue-700 mb-1">💎 活跃球迷</div>
          <div className="text-2xl font-black text-blue-600">{gameState?.activeFans || 0}</div>
          <div className="text-xs text-blue-600 mt-1">人</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-purple-200 p-5">
          <div className="text-xs font-bold text-purple-700 mb-1">🤖 机器人</div>
          <div className="text-2xl font-black text-purple-600">{stats?.botEnabled ? '开启' : '关闭'}</div>
          <div className="text-xs text-purple-600 mt-1">状态</div>
        </div>
      </div>

      {/* 支付 / 提现状态 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-lg border border-indigo-200 p-5">
          <div className="text-xs font-bold text-indigo-700 mb-1">💳 支付网关</div>
          <div className="text-2xl font-black text-indigo-600 uppercase">{stats?.activePaymentGateway || 'mock'}</div>
          <div className="text-xs text-indigo-600 mt-1">当前启用</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-amber-200 p-5">
          <div className="text-xs font-bold text-amber-700 mb-1">💸 待审提现</div>
          <div className="text-2xl font-black text-amber-600">{stats?.pendingWithdrawals || 0}</div>
          <div className="text-xs text-amber-600 mt-1">笔待处理</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-200 p-5">
          <div className="text-xs font-bold text-emerald-700 mb-1">📥 今日充值</div>
          <div className="text-2xl font-black text-emerald-600">${(stats?.todayRecharged || 0).toFixed(2)}</div>
          <div className="text-xs text-emerald-600 mt-1">已确认入金</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-rose-200 p-5">
          <div className="text-xs font-bold text-rose-700 mb-1">📤 今日提现</div>
          <div className="text-2xl font-black text-rose-600">${(stats?.todayWithdrawn || 0).toFixed(2)}</div>
          <div className="text-xs text-rose-600 mt-1">已打款</div>
        </div>
      </div>

      {/* 实时购买流 */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-black text-gray-900">🔥 实时购买流</h3>
          <p className="text-xs text-gray-500 mt-1">最近 20 笔购买记录（2秒刷新）</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {recentPurchases.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              📭 暂无购买记录
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {recentPurchases.map((p, idx) => (
                <div key={p.id || idx} className="px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {(p.user?.nickname || p.userNickname || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">
                        {p.user?.nickname || p.userNickname || 'Player'}
                        {p.user?.isBot && <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">🤖</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(p.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-green-600">
                      +${((p.amount || 0) / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">BF</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
