import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/api'

const STAGES = ['TOP32', 'TOP16', 'TOP8', 'TOP4', 'FINAL', 'CHAMPION']

export default function RoadResults({ token }) {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [teamId, setTeamId] = useState('')
  const [stage, setStage] = useState('TOP32')
  const [result, setResult] = useState(null)
  const [pools, setPools] = useState([])
  const [advancePreview, setAdvancePreview] = useState(null)
  const [eliminatePreview, setEliminatePreview] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/admin/api/road/teams')
      if (!res.ok) { setTeams([]); return }
      const data = await res.json()
      setTeams(data)
      if (!teamId && data[0]?.id) setTeamId(data[0].id)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  useEffect(() => {
    const run = async () => {
      if (!teamId) return
      const res = await adminFetch(`/admin/api/road/pools?teamId=${encodeURIComponent(teamId)}`)
      if (!res.ok) { setPools([]); return }
      setPools(await res.json())
    }
    run()
  }, [teamId, token])

  useEffect(() => {
    const run = async () => {
      if (!teamId || !stage) return
      const [aRes, eRes] = await Promise.all([
        adminFetch('/admin/api/road/results/advance/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId, reachedStage: stage }),
        }),
        adminFetch('/admin/api/road/results/eliminate/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId, eliminatedAtStage: stage }),
        }),
      ])
      setAdvancePreview(aRes.ok ? (await aRes.json()) : null)
      setEliminatePreview(eRes.ok ? (await eRes.json()) : null)
    }
    run()
  }, [teamId, stage, token])

  const executeAction = async () => {
    if (!confirmAction) return
    
    const action = confirmAction
    setConfirmAction(null)
    
    if (action.type === 'advance') {
      const res = await adminFetch('/admin/api/road/results/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, reachedStage: stage }),
      })
      const text = await res.text()
      setResult({ ok: res.ok, text, type: 'advance' })
    } else if (action.type === 'eliminate') {
      const res = await adminFetch('/admin/api/road/results/eliminate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, eliminatedAtStage: stage }),
      })
      const text = await res.text()
      setResult({ ok: res.ok, text, type: 'eliminate' })
    }
    
    if (result?.ok) load()
  }

  const fmt = (v) => (Number(v || 0) / 100).toFixed(2)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">📝 Road Results 管理</h2>
          <p className="text-sm text-gray-500 mt-1">录入晋级/淘汰结果，系统自动关池与结算</p>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-sm font-bold text-sm hover:bg-gray-50">刷新</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 font-bold mb-2">Team</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
              {teams.map(t => <option key={t.id} value={t.id}>{t.code} - {t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-bold mb-2">Stage</label>
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button disabled={loading} onClick={() => setConfirmAction({ type: 'advance' })} className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-60">Advance</button>
            <button disabled={loading} onClick={() => setConfirmAction({ type: 'eliminate' })} className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-60">Eliminate</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-900">Advance Preview</h3>
            {advancePreview?.preview?.alreadySettled && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-bold">Already Settled</span>
            )}
          </div>
          {advancePreview?.preview ? (
            <div className="text-sm space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-gray-500">Holders Eligible</div>
                  <div className="font-bold">{advancePreview.preview.holders?.eligible || 0}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-gray-500">Holders Total</div>
                  <div className="font-bold">{advancePreview.preview.holders?.total || 0}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-gray-500">Pool Budget</div>
                  <div className="font-bold text-emerald-700">{fmt(advancePreview.preview.distribution?.budget)} BF</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-gray-500">Next Pool</div>
                  <div className="font-bold text-blue-700">{advancePreview.preview.distribution?.nextPool?.stage || 'auto-create'}</div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <div className="text-xs text-gray-500 mb-2">资金分配预览</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">toHoldersTarget</span>
                    <span className="font-bold text-green-700">{fmt(advancePreview.preview.distribution?.toHoldersTarget)} BF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">toNext</span>
                    <span className="font-bold text-blue-700">{fmt(advancePreview.preview.distribution?.toNext)} BF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">toSuper</span>
                    <span className="font-bold text-amber-700">{fmt(advancePreview.preview.distribution?.toSuper)} BF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">toReserve</span>
                    <span className="font-bold text-purple-700">{fmt(advancePreview.preview.distribution?.toReserveBase)} BF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">toPlatform</span>
                    <span className="font-bold text-gray-700">{fmt(advancePreview.preview.distribution?.toPlatform)} BF</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Preview not loaded</div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-900">Eliminate Preview</h3>
            {eliminatePreview?.preview?.alreadyEliminated && (
              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-bold">Already Eliminated</span>
            )}
          </div>
          {eliminatePreview?.preview ? (
            <div className="text-sm space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-gray-500">Impacted Pools</div>
                  <div className="font-bold">{eliminatePreview.preview.impactedPools?.length || 0}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-gray-500">Total Budget</div>
                  <div className="font-bold text-red-700">{fmt(eliminatePreview.preview.distribution?.totalFuture)} BF</div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <div className="text-xs text-gray-500 mb-2">资金分配预览</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">toSuper</span>
                    <span className="font-bold text-amber-700">{fmt(eliminatePreview.preview.distribution?.toSuper)} BF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">toSurvivor</span>
                    <span className="font-bold text-green-700">{fmt(eliminatePreview.preview.distribution?.toSurvivor)} BF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">toReserve</span>
                    <span className="font-bold text-purple-700">{fmt(eliminatePreview.preview.distribution?.toReserve)} BF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">toPlatform</span>
                    <span className="font-bold text-gray-700">{fmt(eliminatePreview.preview.distribution?.toPlatform)} BF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">toActivity</span>
                    <span className="font-bold text-blue-700">{fmt(eliminatePreview.preview.distribution?.toActivity)} BF</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Preview not loaded</div>
          )}
        </div>
      </div>

      {result && (
        <div className={`border rounded-2xl p-5 shadow bg-white ${result.ok ? 'border-emerald-200' : 'border-red-200'}`}>
          <div className="flex items-center gap-2">
            <div className={`font-black ${result.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {result.ok ? 'Success' : 'Failed'}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {result.type === 'advance' ? 'Advance' : 'Eliminate'}
            </span>
          </div>
          <pre className="mt-3 text-xs text-slate-700 whitespace-pre-wrap break-words">{result.text}</pre>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-black text-gray-900">Confirm Action</h3>
              <p className="text-sm text-gray-500 mt-1">
                {confirmAction.type === 'advance' ? 'Advance' : 'Eliminate'} - {teams.find(t => t.id === teamId)?.code} at {stage}
              </p>
            </div>
            <div className="p-5">
              <div className="text-xs text-red-600 bg-red-50 rounded-lg p-3 mb-4">
                ⚠️ This action will trigger pool closing, settlement, and fund migration. It must be idempotent.
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 font-bold text-sm hover:bg-gray-50">Cancel</button>
                <button onClick={executeAction} className={`flex-1 px-4 py-2 rounded-xl font-bold text-sm ${confirmAction.type === 'advance' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white`}>
                  Confirm {confirmAction.type === 'advance' ? 'Advance' : 'Eliminate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
