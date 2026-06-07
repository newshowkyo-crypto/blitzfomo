import { useEffect, useMemo, useState } from 'react'
import { adminFetch } from '../lib/api'

const STAGES = ['', 'TOP32', 'TOP16', 'TOP8', 'TOP4', 'FINAL', 'CHAMPION']
const STATUSES = ['', 'DRAFT', 'OPEN', 'CLOSED', 'SETTLED', 'CANCELLED']

export default function RoadPools({ token }) {
  const [pools, setPools] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState('')
  const [status, setStatus] = useState('')
  const [teamId, setTeamId] = useState('')
  const [editModal, setEditModal] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (stage) qs.set('stage', stage)
      if (status) qs.set('status', status)
      if (teamId) qs.set('teamId', teamId)
      const [pRes, tRes] = await Promise.all([
        adminFetch(`/admin/api/road/pools${qs.toString() ? `?${qs.toString()}` : ''}`),
        adminFetch('/admin/api/road/teams'),
      ])
      if (tRes.ok) setTeams(await tRes.json())
      if (!pRes.ok) { setPools([]); return }
      setPools(await pRes.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token, stage, status, teamId])

  const teamIndex = useMemo(() => {
    const m = new Map()
    for (const t of teams) m.set(t.id, t)
    return m
  }, [teams])

  const saveEdit = async () => {
    if (!editModal) return
    const p = editModal
    let parsedParams = undefined
    if (p.editParams?.trim()) {
      try { parsedParams = JSON.parse(p.editParams) } catch { return alert('params 不是合法 JSON') }
    }
    const res = await adminFetch(`/admin/api/road/pools/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        basePrice: Number(p.editBasePrice),
        currentPrice: Number(p.editBasePrice),
        sponsorBudgetLimit: Number(p.editSponsorBudgetLimit),
        status: p.editStatus,
        openAt: p.editOpenAt?.trim() ? p.editOpenAt : null,
        closeAt: p.editCloseAt?.trim() ? p.editCloseAt : null,
        params: parsedParams,
      }),
    })
    alert(res.ok ? '更新成功' : '更新失败（需要超级管理员）')
    setEditModal(null)
    load()
  }

  const openEditModal = (p) => {
    setEditModal({
      ...p,
      editBasePrice: String(p.basePrice),
      editSponsorBudgetLimit: String(p.sponsorBudgetLimit || 0),
      editStatus: p.status,
      editOpenAt: p.openAt ? new Date(p.openAt).toISOString() : '',
      editCloseAt: p.closeAt ? new Date(p.closeAt).toISOString() : '',
      editParams: p.params ? JSON.stringify(p.params, null, 2) : '',
    })
  }

  const getStatusBadge = (status, hasCloseAt) => {
    const bg = {
      DRAFT: 'bg-gray-50 text-gray-700 border-gray-200',
      OPEN: hasCloseAt ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200',
      CLOSED: 'bg-gray-50 text-gray-700 border-gray-200',
      SETTLED: 'bg-amber-50 text-amber-700 border-amber-200',
      CANCELLED: 'bg-red-50 text-red-700 border-red-200',
    }[status] || 'bg-gray-50 text-gray-700 border-gray-200'
    const warning = status === 'OPEN' && !hasCloseAt ? '⚠️ ' : ''
    return <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${bg}`}>{warning}{status}</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">🧱 Road Pools 管理</h2>
          <p className="text-sm text-gray-500 mt-1">查看和管理 RoadPool、调整价格/参数/状态</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={stage} onChange={(e) => setStage(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
            {STAGES.map(s => <option key={s} value={s}>{s || '全部阶段'}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
            {STATUSES.map(s => <option key={s} value={s}>{s || '全部状态'}</option>)}
          </select>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">全部球队</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.code} - {t.name}</option>)}
          </select>
          <button onClick={load} className="px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-sm font-bold text-sm hover:bg-gray-50">刷新</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Sold</th>
                <th className="px-4 py-3">Prize</th>
                <th className="px-4 py-3">Sponsor</th>
                <th className="px-4 py-3">CloseAt</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="9" className="p-8 text-center text-gray-400">⏳ Loading...</td></tr>
              ) : pools.length === 0 ? (
                <tr><td colSpan="9" className="p-8 text-center text-gray-400">No pools found</td></tr>
              ) : pools.map(p => {
                const team = teamIndex.get(p.teamId) || p.team
                const closeAt = p.closeAt ? new Date(p.closeAt).toLocaleString('zh-CN') : '—'
                const isOpenNoClose = p.status === 'OPEN' && !p.closeAt
                return (
                  <tr key={p.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-bold text-gray-900">{team?.code || '-'}</td>
                    <td className="px-4 py-3 font-mono text-sm">{p.stage}</td>
                    <td className="px-4 py-3">{getStatusBadge(p.status, !!p.closeAt)}</td>
                    <td className="px-4 py-3 font-black text-amber-700">{(Number(p.currentPrice) / 100).toFixed(2)} BF</td>
                    <td className="px-4 py-3 font-mono text-sm">{Number(p.soldKeys || 0).toFixed(4)}</td>
                    <td className="px-4 py-3 font-black text-emerald-700">{(Number(p.prizePool || 0) / 100).toFixed(2)} BF</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-blue-700">{(Number(p.sponsorAmount || 0) / 100).toFixed(2)} BF</div>
                      <div className="text-[10px] text-gray-400">limit: {(Number(p.sponsorBudgetLimit || 0) / 100).toFixed(2)}</div>
                    </td>
                    <td className={`px-4 py-3 text-xs ${isOpenNoClose ? 'text-red-700 font-bold' : 'text-gray-500'}`}>
                      {closeAt}
                      {isOpenNoClose && <div className="text-red-600">⚠️ No closeAt</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openEditModal(p)} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-lg border border-blue-200">Edit</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-900">Edit Pool</h3>
                <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="text-sm text-gray-500 mt-1">{(teamIndex.get(editModal.teamId)?.code || editModal.teamId)}.{editModal.stage}</div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Base Price (min unit, 1=0.01 BF)</label>
                <input value={editModal.editBasePrice} onChange={(e) => setEditModal({...editModal, editBasePrice: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sponsor Budget Limit (min unit)</label>
                <input value={editModal.editSponsorBudgetLimit} onChange={(e) => setEditModal({...editModal, editSponsorBudgetLimit: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select value={editModal.editStatus} onChange={(e) => setEditModal({...editModal, editStatus: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  {STATUSES.filter(s => s).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Open At (ISO, optional)</label>
                <input value={editModal.editOpenAt} onChange={(e) => setEditModal({...editModal, editOpenAt: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Close At (ISO, optional)</label>
                <input value={editModal.editCloseAt} onChange={(e) => setEditModal({...editModal, editCloseAt: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Params (JSON, optional)</label>
                <textarea value={editModal.editParams} onChange={(e) => setEditModal({...editModal, editParams: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono" rows="4" />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button onClick={() => setEditModal(null)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 font-bold text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={saveEdit} className="flex-1 px-4 py-2 rounded-xl bg-black text-white font-bold text-sm hover:bg-gray-800">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
