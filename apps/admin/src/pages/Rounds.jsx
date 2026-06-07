import React, { useState, useEffect } from 'react'
import { adminFetch } from '../lib/api'

export default function Rounds({ token }) {
  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedRound, setSelectedRound] = useState(null)
  const pageSize = 20

  const fetchRounds = async (p = 1) => {
    setLoading(true)
    try {
      const res = await adminFetch(`/admin/api/rounds?page=${p}&pageSize=${pageSize}`)
      const data = await res.json()
      setRounds(data.items || [])
      setTotal(data.total || 0)
      setPage(p)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchRoundDetail = async (roundId) => {
    try {
      const res = await adminFetch(`/admin/api/rounds/${roundId}`)
      const data = await res.json()
      setSelectedRound(data)
    } catch (e) {
      alert('❌ 加载轮次详情失败')
    }
  }

  useEffect(() => { fetchRounds() }, [token])

  if (loading && rounds.length === 0) return <div className="text-center py-8 text-gray-500">⏳ 加载中...</div>

  const totalPages = Math.ceil(total / pageSize)

  const statusColors = {
    'OPEN': 'bg-green-100 text-green-800',
    'SETTLED': 'bg-blue-100 text-blue-800',
    'CANCELLED': 'bg-red-100 text-red-800'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-gray-900">🏆 轮次历史</h2>
        <p className="text-sm text-gray-500 mt-1">查看所有游戏轮次的详细记录和结算信息</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
          <div className="text-xs font-bold text-gray-500 mb-1">📊 总轮次</div>
          <div className="text-2xl font-black text-gray-900">{total}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-green-200 p-5">
          <div className="text-xs font-bold text-green-700 mb-1">✅ 已结算</div>
          <div className="text-2xl font-black text-green-600">{rounds.filter(r => r.status === 'SETTLED').length}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-yellow-200 p-5">
          <div className="text-xs font-bold text-yellow-700 mb-1">⏳ 进行中</div>
          <div className="text-2xl font-black text-yellow-600">{rounds.filter(r => r.status === 'OPEN').length}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-blue-200 p-5">
          <div className="text-xs font-bold text-blue-700 mb-1">💰 总奖池</div>
          <div className="text-2xl font-black text-blue-600">
            ${rounds.reduce((sum, r) => sum + (Number(r.prizePool || 0) / 100), 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* 轮次列表 */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">轮次</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">奖池</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">赢家</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">赢家奖金</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">平台收入</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">状态</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">结算时间</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rounds.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    📭 暂无轮次记录
                  </td>
                </tr>
              ) : (
                rounds.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">#{r.roundNumber}</div>
                      <div className="text-xs text-gray-500 font-mono">{r.id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-lg font-bold text-gray-900">${(Number(r.prizePool || 0) / 100).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">
                        {r.winnerNickname || r.winner?.nickname || r.winnerId?.substring(0, 8) + '...' || '-'}
                      </div>
                      {r.winner?.isBot && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">🤖 机器人</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-green-600 font-bold">${(Number(r.winnerAmount || 0) / 100).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-blue-600 font-bold">${(Number(r.platformAmount || 0) / 100).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${statusColors[r.status] || 'bg-gray-100'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {r.settledAt ? new Date(r.settledAt).toLocaleString('zh-CN') : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => fetchRoundDetail(r.id)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                        📊 详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分页 */}
      <div className="flex justify-center items-center gap-2">
        <button
          onClick={() => fetchRounds(page - 1)}
          disabled={page === 1}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ⬅️ 上一页
        </button>
        <div className="flex gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(1, page - 2) + i
            if (p > totalPages) return null
            return (
              <button
                key={p}
                onClick={() => fetchRounds(p)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  p === page
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => fetchRounds(page + 1)}
          disabled={page === totalPages}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          下一页 ➡️
        </button>
      </div>

      {/* 轮次详情弹窗 */}
      {selectedRound && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRound(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black">轮次 #{selectedRound.roundNumber} 详情</h3>
                  <p className="text-sm text-blue-100 mt-1">完整结算信息</p>
                </div>
                <button onClick={() => setSelectedRound(null)} className="text-white hover:bg-white/20 rounded-lg p-2">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <div className="text-xs text-gray-500 font-bold">奖池总额</div>
                  <div className="text-2xl font-black text-gray-900 mt-1">${(Number(selectedRound.prizePool || 0) / 100).toFixed(2)}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-xl">
                  <div className="text-xs text-green-700 font-bold">赢家奖金</div>
                  <div className="text-2xl font-black text-green-600 mt-1">${(Number(selectedRound.winnerAmount || 0) / 100).toFixed(2)}</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl">
                  <div className="text-xs text-blue-700 font-bold">平台收入</div>
                  <div className="text-2xl font-black text-blue-600 mt-1">${(Number(selectedRound.platformAmount || 0) / 100).toFixed(2)}</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl">
                  <div className="text-xs text-purple-700 font-bold">状态</div>
                  <div className="text-xl font-black text-purple-600 mt-1">{selectedRound.status}</div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="text-sm font-bold text-gray-900 mb-2">🏆 赢家信息</div>
                <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">昵称</span>
                    <span className="font-bold">{selectedRound.winnerNickname || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">用户ID</span>
                    <span className="font-mono text-xs">{selectedRound.winnerId || '-'}</span>
                  </div>
                  {selectedRound.winner?.isBot && (
                    <div className="text-xs bg-purple-100 text-purple-800 px-3 py-1 rounded-full inline-block">
                      🤖 机器人用户（奖金已滚入下轮）
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="text-sm font-bold text-gray-900 mb-2">⏰ 时间信息</div>
                <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">创建时间</span>
                    <span className="font-semibold">{new Date(selectedRound.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  {selectedRound.settledAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">结算时间</span>
                      <span className="font-semibold">{new Date(selectedRound.settledAt).toLocaleString('zh-CN')}</span>
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
