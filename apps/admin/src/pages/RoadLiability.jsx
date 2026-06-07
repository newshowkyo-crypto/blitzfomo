import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/api'

export default function RoadLiability({ token }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/admin/api/road/liability')
      if (!res.ok) { setData(null); return }
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">📌 分红负债</h2>
          <p className="text-sm text-gray-500 mt-1">pendingReward 负债总览 + Top 100 持有人</p>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-sm font-bold text-sm hover:bg-gray-50">刷新</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-5">
        <div className="text-xs text-gray-500 font-bold">待释放负债总额</div>
        <div className="text-3xl font-black text-red-700 mt-2">{loading ? '...' : (data?.pendingRewardLiability ?? 0).toFixed(2)} BF</div>
        {!loading && (
          <div className="text-xs text-gray-500 mt-2 space-y-1">
            <div>储备余额: {(data?.reserveBalance ?? 0).toFixed(2)} BF</div>
            <div className={(data?.reserveCoverageRatio ?? 0) < 1 ? 'text-red-700 font-bold' : ''}>
              储备覆盖率: {((data?.reserveCoverageRatio ?? 0) * 100).toFixed(1)}%
            </div>
            <div>更新时间: {new Date(data?.timestamp || Date.now()).toLocaleString('zh-CN')}</div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-6 py-4">用户</th>
                <th className="px-6 py-4">Pool</th>
                <th className="px-6 py-4">Key</th>
                <th className="px-6 py-4">Pending</th>
                <th className="px-6 py-4">Released</th>
                <th className="px-6 py-4">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400">⏳ 加载中...</td></tr>
              ) : (data?.topHoldings || []).length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400">暂无 pendingReward</td></tr>
              ) : (data.topHoldings || []).map(h => (
                <tr key={h.holdingId} className="hover:bg-gray-50/80">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{h.nickname || '未设置'}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{String(h.walletAddress || '').slice(0, 14)}...</div>
                  </td>
                  <td className="px-6 py-4 font-mono">{h.team}.{h.stage}</td>
                  <td className="px-6 py-4 font-mono">{Number(h.keyAmount || 0).toFixed(4)}</td>
                  <td className="px-6 py-4 font-black text-red-700">{Number(h.pendingReward || 0).toFixed(2)} BF</td>
                  <td className="px-6 py-4 font-black text-emerald-700">{Number(h.releasedReward || 0).toFixed(2)} BF</td>
                  <td className="px-6 py-4 text-xs text-gray-500">{new Date(h.updatedAt).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
