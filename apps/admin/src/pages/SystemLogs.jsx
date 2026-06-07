import React, { useState, useEffect } from 'react'
import { adminFetch } from '../lib/api'

export default function SystemLogs({ token }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState('all')
  const pageSize = 50

  const fetchLogs = async (p = 1) => {
    setLoading(true)
    try {
      const url = filter === 'all'
        ? `/admin/api/system-logs?page=${p}&pageSize=${pageSize}`
        : `/admin/api/system-logs?page=${p}&pageSize=${pageSize}&level=${filter}`
      const res = await adminFetch(url)
      if (!res.ok) { setLogs([]); setTotal(0); return }
      const data = await res.json()
      setLogs(data.items || [])
      setTotal(data.total || 0)
      setPage(p)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const res = await adminFetch('/admin/api/system-logs/export.csv')
      const csv = await res.text()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `system-logs-${new Date().toISOString()}.csv`
      a.click()
    } catch (e) {
      alert('❌ 导出失败: ' + e.message)
    }
  }

  useEffect(() => { fetchLogs() }, [token, filter])

  if (loading && logs.length === 0) return <div className="text-center py-8 text-gray-500">⏳ 加载中...</div>

  const totalPages = Math.ceil(total / pageSize)

  const levelColors = {
    'ERROR': 'bg-red-100 text-red-800 border-red-200',
    'WARN': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'INFO': 'bg-blue-100 text-blue-800 border-blue-200',
    'DEBUG': 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const levelIcons = {
    'ERROR': '🔴',
    'WARN': '⚠️',
    'INFO': 'ℹ️',
    'DEBUG': '🔍'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-gray-900">📝 系统日志</h2>
        <p className="text-sm text-gray-500 mt-1">查看系统错误、警告和异常结算记录</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
          <div className="text-xs font-bold text-gray-500 mb-1">📊 总日志</div>
          <div className="text-2xl font-black text-gray-900">{total}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-5">
          <div className="text-xs font-bold text-red-700 mb-1">🔴 错误</div>
          <div className="text-2xl font-black text-red-600">{logs.filter(l => l.level === 'ERROR').length}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-yellow-200 p-5">
          <div className="text-xs font-bold text-yellow-700 mb-1">⚠️ 警告</div>
          <div className="text-2xl font-black text-yellow-600">{logs.filter(l => l.level === 'WARN').length}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-blue-200 p-5">
          <div className="text-xs font-bold text-blue-700 mb-1">ℹ️ 信息</div>
          <div className="text-2xl font-black text-blue-600">{logs.filter(l => l.level === 'INFO').length}</div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="flex flex-wrap gap-2">
          {['all', 'ERROR', 'WARN', 'INFO', 'DEBUG'].map(level => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                filter === level
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {level === 'all' ? '📋 全部' : `${levelIcons[level]} ${level}`}
            </button>
          ))}
        </div>
        <button
          onClick={handleExport}
          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold px-6 py-3 rounded-lg transition-all shadow-md hover:shadow-lg whitespace-nowrap"
        >
          📥 导出 CSV
        </button>
      </div>

      {/* 日志列表 */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">级别</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">时间</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">模块</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">消息</th>
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    📭 暂无日志记录
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${levelColors[log.level] || 'bg-gray-100'}`}>
                        {levelIcons[log.level]} {log.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{log.module || 'system'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-md">
                        <div className="font-semibold text-gray-900 truncate">{log.message}</div>
                        {log.meta && (
                          <div className="text-xs text-gray-500 mt-1 truncate">
                            {typeof log.meta === 'string' ? log.meta : JSON.stringify(log.meta).substring(0, 100)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {log.meta ? (
                        <details className="cursor-pointer">
                          <summary className="text-blue-600 hover:text-blue-800 font-semibold text-sm">👁️ 查看</summary>
                          <pre className="mt-3 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40 border border-gray-300">
                            {typeof log.meta === 'string' ? log.meta : JSON.stringify(log.meta, null, 2)}
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
