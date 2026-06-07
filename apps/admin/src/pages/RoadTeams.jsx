import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/api'

export default function RoadTeams({ token }) {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/admin/api/road/teams')
      if (!res.ok) { setTeams([]); return }
      setTeams(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  const createTeam = async () => {
    const code = (prompt('球队 code (例如 BRA)：') || '').trim().toUpperCase()
    if (!code) return
    const name = (prompt('球队名称：') || '').trim()
    if (!name) return
    const strengthFactor = (prompt('strengthFactor (默认 1.0)：', '1.0') || '1.0').trim()
    const res = await adminFetch('/admin/api/road/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name, strengthFactor }),
    })
    alert(res.ok ? '创建成功' : '创建失败（需要超级管理员）')
    load()
  }

  const editTeam = async (team) => {
    const name = prompt('球队名称：', team.name || '')
    if (name === null) return
    const strengthFactor = prompt('strengthFactor：', String(team.strengthFactor || '1.0'))
    if (strengthFactor === null) return
    const res = await adminFetch(`/admin/api/road/teams/${team.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, strengthFactor }),
    })
    alert(res.ok ? '更新成功' : '更新失败（需要超级管理员）')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">🧩 球队管理</h2>
          <p className="text-sm text-gray-500 mt-1">配置球队、实力系数、概率字段（MVP 主要用 strengthFactor）</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-sm font-bold text-sm hover:bg-gray-50">刷新</button>
          <button onClick={createTeam} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800">新增球队</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">名称</th>
                <th className="px-6 py-4">组</th>
                <th className="px-6 py-4">strength</th>
                <th className="px-6 py-4">状态</th>
                <th className="px-6 py-4 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400">⏳ 加载中...</td></tr>
              ) : teams.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400">暂无球队</td></tr>
              ) : teams.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/80">
                  <td className="px-6 py-4 font-mono font-black text-gray-900">{t.code}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{t.name}</td>
                  <td className="px-6 py-4">{t.groupCode || '-'}</td>
                  <td className="px-6 py-4 font-mono">{String(t.strengthFactor)}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold border bg-slate-50 text-slate-700 border-slate-100">{t.status}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => editTeam(t)} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-lg border border-blue-200">编辑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

