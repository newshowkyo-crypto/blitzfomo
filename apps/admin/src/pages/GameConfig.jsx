import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/api'

export default function GameConfig({ token }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchConfig = async () => {
    const res = await adminFetch('/admin/api/config/game')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    // 转换为前端更友好的数值单位（BigInt 转换为普通数字）
    setConfig({
      ...data,
      initialPrizePool: data.initialPrizePool ? Number(data.initialPrizePool) / 100 : 1000,
      minBuyAmount: data.minBuyAmount ? Number(data.minBuyAmount) / 100 : 1,
      botMinAmount: data.botMinAmount ? Number(data.botMinAmount) / 100 : 1,
      botMaxAmount: data.botMaxAmount ? Number(data.botMaxAmount) / 100 : 50,
    })
    setLoading(false)
  }

  useEffect(() => {
    fetchConfig()
  }, [token])

  const handleSave = async () => {
    setSaving(true)
    try {
      // 提交前重新转换为 BigInt 最小单位（分）
      const payload = {
        ...config,
        initialPrizePool: Math.round(config.initialPrizePool * 100),
        minBuyAmount: Math.round(config.minBuyAmount * 100),
        botMinAmount: Math.round(config.botMinAmount * 100),
        botMaxAmount: Math.round(config.botMaxAmount * 100),
      }

      const res = await adminFetch('/admin/api/config/game', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        alert('配置已保存并立即对游戏生效！')
        fetchConfig()
      } else {
        alert('保存失败，请检查数据权限')
      }
    } catch (e) {
      alert('保存失败，网络或格式错误')
    }
    setSaving(false)
  }

  if (loading || !config) return <div className="text-center py-8 text-gray-500">⏳ 加载中...</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-gray-900">⚙️ 游戏配置</h2>
        <p className="text-sm text-gray-500 mt-1">管理游戏参数和机器人配置（配置热加载，即时生效）</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-4">
          <h3 className="text-lg font-black text-gray-900 border-b pb-2 flex items-center gap-2">
            <span className="text-blue-500">⚙️</span> 基础游戏配置
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">倒计时重置 (秒)</label>
              <input
                type="number"
                value={config.countdownSeconds || 60}
                onChange={e => setConfig({ ...config, countdownSeconds: parseInt(e.target.value) })}
                className="border border-gray-200 p-2.5 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">每次有人买入后，重置到的总秒数</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">最低买入额 (BF)</label>
              <input
                type="number"
                value={config.minBuyAmount || 1}
                onChange={e => setConfig({ ...config, minBuyAmount: parseFloat(e.target.value) })}
                className="border border-gray-200 p-2.5 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">用户购买单次最小限额</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">赢家分成比例 (%)</label>
              <input
                type="number"
                value={config.winnerPercent || 70}
                onChange={e => setConfig({ ...config, winnerPercent: parseInt(e.target.value) })}
                className="border border-gray-200 p-2.5 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">倒计时归零时发给最后买入者的比例</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">平台分成比例 (%)</label>
              <input
                type="number"
                value={config.platformPercent || 30}
                onChange={e => setConfig({ ...config, platformPercent: parseInt(e.target.value) })}
                className="border border-gray-200 p-2.5 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">项目方收取的佣金比例</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">下轮初始奖池注入 (BF)</label>
            <input
              type="number"
              value={config.initialPrizePool || 1000}
              onChange={e => setConfig({ ...config, initialPrizePool: parseFloat(e.target.value) })}
              className="border border-gray-200 p-2.5 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">新的一轮游戏开启时，系统自动注入的初始奖金池数额</p>
          </div>
        </div>

        {/* Bot Settings */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-4">
          <h3 className="text-lg font-black text-gray-900 border-b pb-2 flex items-center gap-2">
            <span className="text-purple-500">🤖</span> 机器人配置
          </h3>

          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-purple-900">机器人陪跑开关</p>
              <p className="text-[10px] text-purple-700">开启后机器人会自动在设定秒数内买入，防止冷场冷启动</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.botEnabled || false}
                onChange={e => setConfig({ ...config, botEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">机器人购买频率 (毫秒)</label>
            <input
              type="number"
              value={config.botPurchaseIntervalMs || 8000}
              onChange={e => setConfig({ ...config, botPurchaseIntervalMs: parseInt(e.target.value) })}
              className="border border-gray-200 p-2.5 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">每个机器人在随机冷场时间（基础以此毫秒数为核心）自动下单</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">机器人单次最低买入 (BF)</label>
              <input
                type="number"
                value={config.botMinAmount || 1}
                onChange={e => setConfig({ ...config, botMinAmount: parseFloat(e.target.value) })}
                className="border border-gray-200 p-2.5 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">机器人单次最高买入 (BF)</label>
              <input
                type="number"
                value={config.botMaxAmount || 50}
                onChange={e => setConfig({ ...config, botMaxAmount: parseFloat(e.target.value) })}
                className="border border-gray-200 p-2.5 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">机器人下单金额将在此最小最大区间内完全随机</p>
        </div>
      </div>

      {/* 前台展示配置 */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-4">
        <h3 className="text-lg font-black text-gray-900 border-b pb-2 flex items-center gap-2">
          <span className="text-emerald-500">🗺️</span> 前台赛事地图
        </h3>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">赛事地图图片 URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={config.tournamentMapUrl || ''}
              onChange={e => setConfig({ ...config, tournamentMapUrl: e.target.value })}
              placeholder="https://example.com/tournament-map.png（留空则前台使用本地默认占位图）"
              className="border border-gray-200 p-2.5 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => setConfig({ ...config, tournamentMapUrl: '' })}
              className="whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              ↩️ 恢复默认
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">前台“赛事地图”页将展示此图片；留空（恢复默认）时自动回退到本地默认世界杯赛程图。修改后需点击下方“保存配置”生效。</p>
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-1">预览（{config.tournamentMapUrl ? '后台配置 URL' : '本地默认图'}）</div>
          <div className="rounded-xl overflow-hidden border border-gray-100 max-w-xs">
            <img
              src={config.tournamentMapUrl || '/media/tournament-map.png'}
              alt="赛事地图预览"
              className="w-full h-auto"
              onError={(e) => { if (e.currentTarget.src.indexOf('/media/tournament-map.png') === -1) e.currentTarget.src = '/media/tournament-map.png' }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="text-sm text-gray-600">
            ⚠️ 注意：更改此处的参数将实时对在线用户和底层高并发账本产生影响。请谨慎操作。
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold px-8 py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg whitespace-nowrap"
          >
            {saving ? '💾 保存中...' : '💾 保存配置'}
          </button>
        </div>
      </div>
    </div>
  )
}
