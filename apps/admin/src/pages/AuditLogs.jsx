import React, { useState, useEffect } from 'react'
import { adminFetch } from '../lib/api'

export default function AuditLogs({ token }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const fetchLogs = async (p = 1) => {
    setLoading(true)
    try {
      const res = await adminFetch(`/admin/api/audit-logs?page=${p}&pageSize=${pageSize}`)
      const data = await res.json()
      setLogs(data.items || [])
      setTotal(data.total || 0)
      setPage(p)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [token])

  const handleExport = async () => {
    try {
      const res = await adminFetch('/admin/api/audit-logs/export.csv')
      const csv = await res.text()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString()}.csv`
      a.click()
    } catch (e) {
      alert('导出失败: ' + e.message)
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">⏳ 加载中...</div>

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-gray-900">📋 操作审计日志</h2>
        <p className="text-sm text-gray-500 mt-1">查看所有管理员操作记录</p>
      </div>
      
      {/* 工具栏 */}
      <div className="flex justify-between items-center bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="text-sm font-semibold text-gray-700">
          📊 共 <span className="text-blue-600 font-black">{total}</span> 条记录，第 <span className="text-blue-600 font-black">{page}</span> / <span className="text-blue-600 font-black">{totalPages}</span> 页
        </div>
        <button 
          onClick={handleExport}
          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold px-6 py-3 rounded-lg transition-all shadow-md hover:shadow-lg"
        >
          📥 导出 CSV
        </button>
      </div>

      {/* 日志表格 */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">⏰ 时间</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">👤 管理员</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">⚙️ 操作</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">🎯 目标类型</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">🔑 目标ID</th>
              <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">📝 详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  📭 暂无日志记录
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{log.admin?.username || log.adminId}</td>
                  <td className="px-6 py-4 font-mono text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded inline-block">{log.action}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{log.targetType || '—'}</td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">{log.targetId ? log.targetId.substring(0, 12) + '...' : '—'}</td>
                  <td className="px-6 py-4 text-xs">
                    {log.after ? (
                      <details className="cursor-pointer">
                        <summary className="text-blue-600 hover:text-blue-800 font-semibold">👁️ 查看</summary>
                        <pre className="mt-3 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40 border border-gray-300">
                          {JSON.stringify(log.after, null, 2)}
                        </pre>
                      </details>
                    ) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <div className="flex justify-center items-center gap-2">
        <button 
          onClick={() => fetchLogs(page - 1)}
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
                onClick={() => fetchLogs(p)}
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
          onClick={() => fetchLogs(page + 1)}
          disabled={page === totalPages}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          下一页 ➡️
        </button>
      </div>
    </div>
  )
}
