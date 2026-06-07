import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/api'

export default function Users({ token }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [ledger, setLedger] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const fetchUsers = async (term = search, status = filterStatus) => {
    setLoading(true)
    try {
      const q = []
      if (term && term.trim()) q.push(`search=${encodeURIComponent(term.trim())}`)
      if (status !== 'all') q.push(`status=${status}`)
      const query = q.length ? `?${q.join('&')}` : ''
      const res = await adminFetch(`/admin/api/users${query}`)
      if (!res.ok) { setUsers([]); return }
      const data = await res.json()
      setUsers(data.items || data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers('', 'all') }, [token])

  useEffect(() => {
    const timer = setTimeout(() => { fetchUsers(search, filterStatus) }, 350)
    return () => clearTimeout(timer)
  }, [search, filterStatus])

  const openDetail = async (user) => {
    setDetail(user)
    setLedger([])
    setDetailLoading(true)
    try {
      const [detailRes, ledgerRes] = await Promise.all([
        adminFetch(`/admin/api/users/${user.id}`),
        adminFetch(`/admin/api/users/${user.id}/ledger?pageSize=12`)
      ])
      setDetail(await detailRes.json())
      const ledgerData = await ledgerRes.json()
      setLedger(ledgerData.items || [])
    } finally {
      setDetailLoading(false)
    }
  }

  const handleFreeze = async (id, currentStatus) => {
    const reason = prompt(currentStatus ? '请输入解冻原因：' : '请输入冻结原因：', currentStatus ? '解冻' : '疑似刷单风控')
    if (reason === null) return
    const res = await adminFetch(`/admin/api/users/${id}/freeze`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ freeze: !currentStatus, reason })
    })
    alert(res.ok ? (currentStatus ? '✅ 账号已解冻' : '✅ 账号已冻结') : '❌ 操作失败，权限不足')
    fetchUsers(search, filterStatus)
  }

  const handleAdjustBalance = async (id) => {
    const amount = parseFloat(prompt('请输入调账 BF 数量，支持负数：') || '')
    if (!amount) return alert('⚠️ 请输入有效的非零数值')
    const reason = prompt('请输入调账备注：')
    if (!reason) return alert('⚠️ 调账必须输入原因备注')
    const res = await adminFetch(`/admin/api/users/${id}/adjust-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, reason })
    })
    alert(res.ok ? '✅ 调账成功' : '❌ 调账失败，仅超级管理员可操作')
    fetchUsers(search, filterStatus)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <span>👥</span>
            <span>用户管理</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">查看用户、账本流水、冻结和手动调账</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="active">正常</option>
            <option value="frozen">冻结</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 搜索昵称 / 钱包地址 / 用户ID"
            className="w-full md:w-80 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          />
          <span className="bg-white border border-gray-200 shadow-sm px-4 py-2.5 rounded-xl text-sm text-gray-600 font-medium">
            当前显示: <span className="font-bold text-blue-600">{users.length}</span>
          </span>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider">昵称</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider">钱包地址</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider">余额</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider">累计买入</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider">注册时间</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider">状态</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-600 uppercase tracking-wider text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-500 text-sm">加载中...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-gray-500 text-sm">{search ? '没有匹配的用户' : '暂无注册用户数据'}</p>
                  </td>
                </tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/80 transition-all duration-200">
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => openDetail(u)} 
                      className="font-bold text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {u.nickname || '未设置'}
                    </button>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">{u.id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-500 max-w-xs truncate">{u.walletAddress}</td>
                  <td className="px-6 py-4">
                    <span className="font-black text-blue-600">{(Number(u.balance) / 100).toFixed(2)} BF</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-700">{(Number(u.totalPurchased) / 100).toFixed(2)} BF</span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">{new Date(u.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${
                        u.isFrozen 
                          ? 'bg-red-50 text-red-700 border border-red-200' 
                          : 'bg-green-50 text-green-700 border border-green-200'
                      }`}>
                        {u.isFrozen ? '已冻结' : '正常'}
                      </span>
                      {u.isBot && (
                        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">🤖</span>
                      )}
                    </div>
                    {u.frozenReason && (
                      <p className="text-[10px] text-red-400 mt-1 truncate max-w-xs">原因: {u.frozenReason}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap justify-center gap-2">
                      <button 
                        onClick={() => openDetail(u)} 
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-2 rounded-lg border border-blue-200 transition-all"
                      >
                        详情
                      </button>
                      <button 
                        onClick={() => handleAdjustBalance(u.id)} 
                        className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold px-3 py-2 rounded-lg border border-amber-200 transition-all"
                      >
                        调账
                      </button>
                      <button 
                        onClick={() => handleFreeze(u.id, u.isFrozen)} 
                        className={`text-xs font-bold px-3 py-2 rounded-lg border transition-all ${
                          u.isFrozen 
                            ? 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200' 
                            : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                        }`}
                      >
                        {u.isFrozen ? '解冻' : '冻结'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-5 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black">{detail.nickname || '未设置昵称'}</h3>
                <p className="text-xs text-slate-300 font-mono mt-1 break-all max-w-md">{detail.walletAddress}</p>
              </div>
              <button 
                onClick={() => setDetail(null)} 
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border border-blue-200">
                  <div className="text-xs text-blue-600 font-bold uppercase">余额</div>
                  <div className="text-2xl font-black text-blue-900 mt-1">{(Number(detail.balance || 0) / 100).toFixed(2)} BF</div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-4 border border-amber-200">
                  <div className="text-xs text-amber-600 font-bold uppercase">累计买入</div>
                  <div className="text-2xl font-black text-amber-900 mt-1">{(Number(detail.totalPurchased || 0) / 100).toFixed(2)}</div>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-4 border border-emerald-200">
                  <div className="text-xs text-emerald-600 font-bold uppercase">累计赢得</div>
                  <div className="text-2xl font-black text-emerald-900 mt-1">{(Number(detail.totalWon || 0) / 100).toFixed(2)}</div>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-4 border border-slate-200">
                  <div className="text-xs text-slate-600 font-bold uppercase">状态</div>
                  <div className={`text-2xl font-black mt-1 ${detail.isFrozen ? 'text-red-600' : 'text-green-600'}`}>
                    {detail.isFrozen ? '冻结' : '正常'}
                  </div>
                </div>
              </div>

              {/* Ledger */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-black text-gray-900">账本流水</h4>
                  {detailLoading && (
                    <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                  {detailLoading ? (
                    <div className="p-8 text-center">
                      <div className="w-6 h-6 border-4 border-gray-200 border-t-gray-400 rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-gray-500 text-sm">加载中...</p>
                    </div>
                  ) : ledger.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="text-3xl mb-2">📭</div>
                      <p className="text-gray-500 text-sm">暂无流水记录</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {ledger.map(row => (
                        <div key={row.id} className="p-4 flex justify-between gap-4 hover:bg-white/50 transition-colors">
                          <div>
                            <div className="font-bold text-gray-900">{row.type}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{row.description || '—'}</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-black text-lg ${Number(row.amount) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {(Number(row.amount) / 100).toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-400">{new Date(row.createdAt).toLocaleString('zh-CN')}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
