import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/api'

export default function Withdrawals({ token }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('PENDING_REVIEW')
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchList = async () => {
    setLoading(true)
    try {
      const url = filter ? `/admin/api/withdrawals?status=${filter}` : '/admin/api/withdrawals'
      const res = await adminFetch(url)
      if (!res.ok) { setList([]); return }
      const data = await res.json()
      setList(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchList() }, [token, filter])

  const copyText = async (text) => {
    await navigator.clipboard.writeText(text)
    alert('已复制钱包地址')
  }

  const handleApprove = async (id) => {
    if (!window.confirm('确认批准此提现申请？')) return
    const remark = prompt('批准备注（可选）：') || ''

    await adminFetch(`/admin/api/withdrawals/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remark })
    })
    fetchList()
  }

  const handleMarkPaid = async (id) => {
    const txHash = prompt('请输入交易哈希/TxID（可先留空）：') || ''
    if (!window.confirm('确认已完成打款？此操作不可撤销！')) return

    const res = await adminFetch(`/admin/api/withdrawals/${id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash })
    })
    if (res.ok) alert('✅ 已标记为已支付')
    else alert('❌ 操作失败，请确认权限')
    fetchList()
  }
    
  const handleRejectSubmit = async (id) => {
    if (!rejectReason.trim()) {
      alert('请输入拒绝原因')
      return
    }

    await adminFetch(`/admin/api/withdrawals/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason })
    })
    setRejectModal(null)
    setRejectReason('')
    fetchList()
  }

  if (loading) return <div className="text-center py-8 text-gray-500">⏳ 加载中...</div>

  const statusColors = {
    'PENDING_REVIEW': 'bg-yellow-100 text-yellow-800',
    'APPROVED': 'bg-blue-100 text-blue-800',
    'PAID': 'bg-green-100 text-green-800',
    'REJECTED': 'bg-red-100 text-red-800',
    'FAILED': 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3">
        <div>
          <h2 className="text-3xl font-black text-gray-900">💸 提现审核管理</h2>
          <p className="text-sm text-gray-500 mt-1">审核提现、复制地址、记录人工打款凭证</p>
        </div>
        <div className="text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-3 py-2 font-bold">批准 → 确认打款 → PAID</div>
      </div>

      {/* 状态过滤 */}
      <div className="flex flex-wrap gap-2">
        {['PENDING_REVIEW', 'APPROVED', 'PAID', 'REJECTED'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(filter === status ? null : status)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              filter === status
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'PENDING_REVIEW' ? '⏳ 待审核' : 
             status === 'APPROVED' ? '✅ 已批准' :
             status === 'PAID' ? '💰 已支付' : '❌ 已拒绝'}
          </button>
        ))}
      </div>

      {/* 提现列表 */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">用户</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">金额</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">钱包地址</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">状态</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">申请时间</th>
              <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {list.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  📭 暂无提现申请
                </td>
              </tr>
            ) : (
              list.map(w => (
                <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{w.user?.nickname || w.userId}</div>
                    <div className="text-xs text-gray-500 font-mono">{w.userId.substring(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-lg font-bold text-gray-900">${(w.amountUsdt / 100).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">USDT</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-xs text-gray-600 max-w-xs truncate">{w.toAddress}</div>
                      <button onClick={() => copyText(w.toAddress)} className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold">复制</button>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">{w.chain || 'TON'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${statusColors[w.status] || 'bg-gray-100'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(w.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {w.status === 'PENDING_REVIEW' && (
                      <div className="flex gap-2 justify-center">
                        <button 
                          onClick={() => handleApprove(w.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors"
                        >
                          ✅ 批准
                        </button>
                        <button 
                          onClick={() => setRejectModal(w.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors"
                        >
                          ❌ 拒绝
                        </button>
                      </div>
                    )}
                    {w.status === 'APPROVED' && (
                      <button
                        onClick={() => handleMarkPaid(w.id)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                        💰 确认打款
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

      {/* 拒绝原因模态框 */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">拒绝提现申请</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              rows="4"
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 font-bold rounded-lg hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleRejectSubmit(rejectModal)}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
              >
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
