import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/api'

const toBf = (value) => Number(value || 0) / 100
const toMinor = (value) => Math.round(Number(value || 0) * 100)

export default function BotConfig({ token }) {
  const [config, setConfig] = useState(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const fetchConfig = async () => {
    const res = await adminFetch('/admin/api/config/bot')
    const data = await res.json()
    setConfig({
      ...data,
      botMinAmount: toBf(data.botMinAmount),
      botMaxAmount: toBf(data.botMaxAmount),
    })
  }

  useEffect(() => { fetchConfig() }, [token])

  const save = async () => {
    setSaving(true)
    setMessage('')
    const payload = {
      botEnabled: !!config.botEnabled,
      botPurchaseIntervalMs: Math.max(Number(config.botPurchaseIntervalMs || 30000), 10000),
      botMinAmount: toMinor(config.botMinAmount),
      botMaxAmount: toMinor(config.botMaxAmount),
    }
    const res = await adminFetch('/admin/api/config/bot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setMessage(res.ok ? '机器人配置已保存。' : '保存失败：仅超级管理员可操作。')
    setSaving(false)
    fetchConfig()
  }

  const triggerOnce = async () => {
    setBusy(true)
    setMessage('')
    const res = await adminFetch('/admin/api/config/bot/trigger-once', {
      method: 'POST',
    })
    const data = await res.json().catch(() => ({}))
    setMessage(res.ok && data.success ? `已触发一次机器人活动：${data.bot || '-'} / ${data.amount || 0} BF。` : (data.message || '触发失败'))
    setBusy(false)
  }

  const createBots = async () => {
    const count = parseInt(prompt('创建机器人数量（最多 50）：', '10') || '0', 10)
    if (!count) return
    setBusy(true)
    setMessage('')
    const res = await adminFetch('/admin/api/config/bot/create-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    })
    const data = await res.json().catch(() => ({}))
    setMessage(res.ok ? `已创建 ${data.created || count} 个机器人账号。` : '创建失败。')
    setBusy(false)
  }

  if (!config) return <div className="text-center py-8 text-gray-500">加载中...</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-gray-900">🤖 机器人控制台</h2>
        <p className="text-sm text-gray-500 mt-1">用于冷启动测试和运营观察；机器人活动不增加真实可兑付奖池，也不会抢占真人赢家。</p>
      </div>

      {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 space-y-5">
          <label className="flex items-center justify-between p-4 rounded-2xl bg-purple-50 border border-purple-100">
            <div>
              <div className="font-black text-purple-900">自动机器人活动</div>
              <div className="text-xs text-purple-700 mt-1">开启后按间隔进入队列；建议生产先关闭，人工小流量验证后再开。</div>
            </div>
            <input type="checkbox" checked={!!config.botEnabled} onChange={e => setConfig({ ...config, botEnabled: e.target.checked })} className="w-5 h-5" />
          </label>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">自动触发间隔（毫秒）</label>
            <input type="number" min="10000" step="1000" value={config.botPurchaseIntervalMs || 30000} onChange={e => setConfig({ ...config, botPurchaseIntervalMs: Number(e.target.value) })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            <p className="text-xs text-gray-500 mt-1">下限 10000ms；系统会按此间隔节流，不再每 10 秒硬触发。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">单次最低活动金额（BF）</label>
              <input type="number" min="1" step="1" value={config.botMinAmount || 1} onChange={e => setConfig({ ...config, botMinAmount: Number(e.target.value) })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">单次最高活动金额（BF）</label>
              <input type="number" min="1" step="1" value={config.botMaxAmount || 1} onChange={e => setConfig({ ...config, botMaxAmount: Number(e.target.value) })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <b>安全说明：</b>机器人购买会进入活动记录并标记为 isBot，但不扣真实余额、不增加可兑付奖池、不重置真人比赛倒计时。不要用它伪造提现或承诺收益。
          </div>

          <button onClick={save} disabled={saving} className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white font-black py-3 rounded-xl shadow-lg disabled:opacity-50">{saving ? '保存中...' : '保存配置'}</button>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-emerald-950 rounded-2xl shadow-lg p-6 text-white space-y-4">
          <h3 className="text-xl font-black">快捷动作</h3>
          <p className="text-xs text-slate-300">手动触发用于检查前台活动流、Socket 与后台审计。</p>
          <button onClick={triggerOnce} disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3 rounded-xl disabled:opacity-50">立即触发一次活动</button>
          <button onClick={createBots} disabled={busy} className="w-full bg-white/10 hover:bg-white/20 text-white font-black py-3 rounded-xl border border-white/10 disabled:opacity-50">批量创建机器人账号</button>
        </div>
      </div>
    </div>
  )
}
