import React, { useState, useEffect } from 'react'
import { adminFetch } from '../lib/api'

export default function Payments({ token }) {
  const [list, setList] = useState([])
  const [gateways, setGateways] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [switching, setSwitching] = useState('')
  const [stats, setStats] = useState({ total: 0, pending: 0, paid: 0, failed: 0 })

  const gatewayLabel = (name) => {
    if (name === 'plisio') return 'Plisio (生产真实支付)'
    if (name === 'mock') return 'Mock (仅应急回退)'
    return name
  }

  const fetchList = async () => {
    setLoading(true)
    try {
      const url = filter === 'all' ? '/admin/api/payment/orders' : `/admin/api/payment/orders?status=${filter}`
      const [ordersRes, gatewaysRes] = await Promise.all([
        adminFetch(url),
        adminFetch('/admin/api/payment/gateways')
      ])
      const ordersData = await ordersRes.json()
      const gatewaysData = await gatewaysRes.json()
      const items = ordersData.items || []
      setList(items)
      setGateways(gatewaysData)

      // 计算统计
      const allRes = await adminFetch('/admin/api/payment/orders')
      const allData = await allRes.json()
      const allItems = allData.items || []
      setStats({
        total: allItems.length,
        pending: allItems.filter(p => p.status === 'PENDING').length,
        paid: allItems.filter(p => p.status === 'PAID').length,
        failed: allItems.filter(p => p.status === 'FAILED').length
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList() }, [token, filter])

  const handleMarkPaid = async (id) => {
    const remark = prompt('备注（可选）：')
    if (remark === null) return

    try {
      const res = await adminFetch(`/admin/api/payment/orders/${id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remark: remark || '手动标记' })
      })
      if (!res.ok) throw new Error('标记失败')
      alert('✅ 已标记为已支付')
      fetchList()
    } catch (e) {
      alert('❌ 操作失败: ' + e.message)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('✅ 已复制到剪贴板')
    }).catch(() => {
      alert('❌ 复制失败')
    })
  }

  const handleActivateGateway = async (name) => {
    if (name === gateways?.active) return
    if (name === 'plisio' && !confirm('切换到 Plisio 后，用户充值会生成真实加密货币发票。确认切换？')) return
    if (name === 'mock' && !confirm('Mock 只允许紧急回退或本地测试使用。生产切到 Mock 后，真实充值会被暂停。确认继续？')) return

    setSwitching(name)
    try {
      const res = await adminFetch(`/admin/api/payment/gateways/${name}/activate`, {
        method: 'PATCH'
      })
      if (!res.ok) throw new Error('switch failed')
      await fetchList()
      alert(`已切换到 ${gatewayLabel(name)}`)
    } catch {
      alert('切换失败，请确认当前账号是 SUPER_ADMIN')
    } finally {
      setSwitching('')
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">⏳ 加载中...</div>

  const statusColors = {
    'PENDING': 'bg-yellow-100 text-yellow-800',
    'PAID': 'bg-green-100 text-green-800',
    'FAILED': 'bg-red-100 text-red-800'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-gray-900">💳 订单管理</h2>
        <p className="text-sm text-gray-500 mt-1">管理和追踪所有支付订单</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
          <div className="text-xs font-bold text-gray-500 mb-1">📊 总订单</div>
          <div className="text-2xl font-black text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-yellow-200 p-5">
          <div className="text-xs font-bold text-yellow-700 mb-1">⏳ 待支付</div>
          <div className="text-2xl font-black text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-green-200 p-5">
          <div className="text-xs font-bold text-green-700 mb-1">✅ 已支付</div>
          <div className="text-2xl font-black text-green-600">{stats.paid}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-5">
          <div className="text-xs font-bold text-red-700 mb-1">❌ 失败</div>
          <div className="text-2xl font-black text-red-600">{stats.failed}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-sm font-black text-gray-900">💳 支付网关</div>
            <div className="text-xs text-gray-500 mt-1">
              当前：<span className="font-bold text-emerald-700">{gatewayLabel(gateways?.active || 'plisio')}</span>
              <span className="mx-2">·</span>
              生产充值正在使用真实 Plisio 网关；Mock 仅保留为故障应急回退。
            </div>
            {gateways?.active === 'plisio' && (
              <div className="text-xs text-blue-600 mt-2 font-mono bg-blue-50 p-2 rounded">
                📌 Plisio Webhook URL: <span className="font-bold">https://blitzfomo.com/api/payment/webhook/plisio?json=true</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {['plisio'].map(name => (
              <button
                key={name}
                onClick={() => handleActivateGateway(name)}
                disabled={switching || name === gateways?.active}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  name === gateways?.active
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-gray-900 text-white hover:bg-black disabled:opacity-50'
                }`}
              >
                {switching === name ? '切换中...' : name === gateways?.active ? `✅ ${gatewayLabel(name)}` : `切到 ${gatewayLabel(name)}`}
              </button>
            ))}
            {gateways?.active === 'mock' && (
              <button
                onClick={() => handleActivateGateway('plisio')}
                disabled={switching}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                恢复 Plisio 生产支付
              </button>
            )}
            <button
              onClick={() => handleActivateGateway('mock')}
              disabled={switching || gateways?.active === 'mock'}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-white text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
              title="仅在 Plisio 故障时使用"
            >
              应急切 Mock
            </button>
          </div>
        </div>
      </div>
      
      {/* 状态过滤 */}
      <div className="flex flex-wrap gap-2">
        {['all', 'PENDING', 'PAID', 'FAILED'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              filter === status
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? '📋 全部' : status === 'PENDING' ? '⏳ 待支付' : status === 'PAID' ? '✅ 已支付' : '❌ 失败'}
          </button>
        ))}
      </div>

      {/* 订单列表 */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">订单ID</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">用户</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">金额</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">支付网关</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">状态</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">创建时间</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {list.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    📭 暂无订单
                  </td>
                </tr>
              ) : (
                list.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-600">{p.id.substring(0, 12)}...</span>
                        <button
                          onClick={() => copyToClipboard(p.id)}
                          className="text-blue-600 hover:text-blue-800 text-xs"
                          title="复制完整订单号"
                        >
                          📋
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{p.user?.nickname || p.userId?.substring(0, 8) + '...'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-lg font-bold text-gray-900">${(p.amountUsdt / 100).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.gateway}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${statusColors[p.status] || 'bg-gray-100'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(p.createdAt).toLocaleString('zh-CN')}</td>
                    <td className="px-6 py-4 text-center">
                      {p.status === 'PENDING' && (
                        <button
                          onClick={() => handleMarkPaid(p.id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"
                        >
                          ✅ 标记已支付
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
