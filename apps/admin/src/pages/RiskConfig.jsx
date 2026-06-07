import React, { useState, useEffect } from 'react'
import { adminFetch } from '../lib/api'

const moneyFields = new Set([
  'withdrawMinAmount',
  'withdrawMaxAmountDaily',
  'purchaseMaxAmountPerTx',
  'largeAmountThreshold',
])

const fields = [
  ['withdrawRequirePurchaseCount', '最低购买次数', '用户至少购买多少次后才允许提现', 'number'],
  ['withdrawCooldownHours', '提现冷却时间（小时）', '两次提现之间的最短间隔', 'number'],
  ['withdrawMinAmount', '单次最低提现（BF）', '低于该金额的提现申请会被拒绝', 'money'],
  ['withdrawMaxAmountDaily', '每日最高提现（BF）', '单个用户每天最多可提现金额', 'money'],
  ['purchaseMaxAmountPerTx', '单次最高购买（BF）', '单笔购买的风控上限', 'money'],
  ['purchaseRateLimitPerMin', '购买频率限制（次/分钟）', '单个用户每分钟最多购买次数', 'number'],
  ['largeAmountThreshold', '大额告警阈值（BF）', '超过该金额的操作可进入人工关注', 'money'],
]

function fromApi(data) {
  const next = { ...data }
  for (const field of moneyFields) {
    if (next[field] !== undefined && next[field] !== null) {
      next[field] = Number(next[field]) / 100
    }
  }
  return next
}

function toApi(config) {
  const next = { ...config }
  for (const field of moneyFields) {
    if (next[field] !== undefined && next[field] !== null) {
      next[field] = Math.round(Number(next[field]) * 100)
    }
  }
  return next
}

export default function RiskConfig({ token }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const fetchConfig = async () => {
    setLoading(true)
    setMessage('')
    try {
      const res = await adminFetch('/admin/api/config/risk')
      if (!res.ok) {
        setConfig(null)
        setMessage('无法加载风控配置')
        return
      }
      const data = await res.json()
      setConfig(fromApi(data))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfig() }, [token])

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await adminFetch('/admin/api/config/risk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toApi(config)),
      })
      if (!res.ok) throw new Error(await res.text())
      setMessage('风控配置已保存')
      fetchConfig()
    } catch (e) {
      setMessage('保存失败，请检查权限或输入格式')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">⏳ 加载中...</div>
  if (!config) return (
    <div className="text-center py-8">
      <div className="text-red-500 font-bold">❌ 无法加载配置</div>
      <div className="text-sm text-gray-500 mt-2">{message || '请检查权限或网络连接'}</div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-gray-900">🛡️ 风控配置</h2>
        <p className="text-sm text-gray-500 mt-1">管理提现、购买和大额操作的风控参数</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200 p-8">
        <div className="max-w-2xl space-y-6">
          {fields.map(([field, label, help, kind]) => (
            <div key={field}>
              <label className="block text-sm font-bold text-gray-900 mb-2">{label}</label>
              <input
                type="number"
                min="0"
                step={kind === 'money' ? '0.01' : '1'}
                value={config[field] ?? 0}
                onChange={e => handleChange(field, kind === 'money' ? Number(e.target.value) : parseInt(e.target.value || '0', 10))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">{help}</p>
            </div>
          ))}

          {message && (
            <div className={`text-sm font-semibold ${message.includes('失败') ? 'text-red-600' : 'text-green-600'}`}>
              {message.includes('失败') ? '❌' : '✅'} {message}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            {saving ? '💾 保存中...' : '💾 保存配置'}
          </button>
        </div>
      </div>
    </div>
  )
}
