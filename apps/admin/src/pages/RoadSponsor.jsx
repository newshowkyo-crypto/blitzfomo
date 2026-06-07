import { useEffect, useMemo, useState } from 'react'
import { adminFetch } from '../lib/api'

export default function RoadSponsor({ token }) {
  const [pools, setPools] = useState([])
  const [loading, setLoading] = useState(true)
  const [poolId, setPoolId] = useState('')
  const [amount, setAmount] = useState('10')
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [result, setResult] = useState(null)
  const [budget, setBudget] = useState(null)
  const [budgetTotal, setBudgetTotal] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [pRes, bRes] = await Promise.all([
        adminFetch('/admin/api/road/pools'),
        adminFetch('/admin/api/road/sponsor/budget'),
      ])
      if (bRes.ok) {
        const b = await bRes.json()
        setBudget(b)
        if (!budgetTotal) setBudgetTotal(((Number(b.totalBudget || 0) / 100).toFixed(2)))
      }
      if (!pRes.ok) { setPools([]); return }
      const data = await pRes.json()
      setPools(data)
      if (!poolId && data[0]?.id) setPoolId(data[0].id)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  const poolIndex = useMemo(() => {
    const m = new Map()
    for (const p of pools) m.set(p.id, p)
    return m
  }, [pools])

  useEffect(() => {
    if (!reference) {
      setReference(`sponsor_${Date.now()}_${Math.random().toString(16).slice(2)}`)
    }
  }, [reference])

  const sponsor = async () => {
    if (!poolId) return
    const amt = Number(amount)
    if (!amt || amt <= 0) return alert('请输入有效金额')
    if (!reference?.trim()) return alert('Reference 不能为空')
    
    const p = poolIndex.get(poolId)
    const tag = p?.team?.code ? `${p.team.code}.${p.stage}` : poolId
    const limit = Number(p?.sponsorBudgetLimit || 0) / 100
    const used = Number(p?.sponsorAmount || 0) / 100
    const remain = limit - used
    const gTotal = Number(budget?.totalBudget || 0) / 100
    const gUsed = Number(budget?.usedBudget || 0) / 100
    const gRemain = Number(budget?.remainingBudget || 0) / 100
    
    if (limit > 0 && amt > remain) return alert(`超过单池预算上限，剩余 ${remain.toFixed(2)} BF`)
    if (gTotal > 0 && amt > gRemain) return alert(`超过全局预算上限，剩余 ${gRemain.toFixed(2)} BF`)

    const res = await adminFetch(`/admin/api/road/pools/${poolId}/sponsor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, note, reference }),
    })
    const text = await res.text()
    const data = await res.json().catch(() => null)
    
    if (!res.ok && data?.message?.toLowerCase().includes('duplicate')) {
      setResult({ ok: false, text: 'Error: Duplicate reference detected. This reference has already been used.' })
    } else {
      setResult({ ok: res.ok, text })
    }
    
    if (res.ok) {
      setNote('')
      setReference(`sponsor_${Date.now()}_${Math.random().toString(16).slice(2)}`)
      load()
    }
  }

  const saveBudget = async () => {
    const v = Number(budgetTotal)
    if (!Number.isFinite(v) || v <= 0) return alert('请输入有效全局预算')
    const res = await adminFetch('/admin/api/road/sponsor/budget', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalBudget: v, status: budget?.status || 'ACTIVE' }),
    })
    const text = await res.text()
    setResult({ ok: res.ok, text })
    if (res.ok) load()
  }

  const gTotal = Number(budget?.totalBudget || 0) / 100
  const gUsed = Number(budget?.usedBudget || 0) / 100
  const gRemain = Number(budget?.remainingBudget || 0) / 100

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">🏷️ Road Sponsor 管理</h2>
          <p className="text-sm text-gray-500 mt-1">官方赞助资金注入（不计入实际购买）</p>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-sm font-bold text-sm hover:bg-gray-50">刷新</button>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5">
        <div className="text-xs text-blue-700 font-bold mb-4">💡 Official Sponsored is NOT real user purchase</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 rounded-xl p-4">
            <div className="text-xs text-gray-500">Total Budget</div>
            <div className="text-2xl font-black text-blue-700 mt-1">{gTotal.toFixed(2)} BF</div>
          </div>
          <div className="bg-white/80 rounded-xl p-4">
            <div className="text-xs text-gray-500">Used</div>
            <div className="text-2xl font-black text-amber-700 mt-1">{gUsed.toFixed(2)} BF</div>
          </div>
          <div className="bg-white/80 rounded-xl p-4">
            <div className="text-xs text-gray-500">Remaining</div>
            <div className={`text-2xl font-black mt-1 ${gRemain < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {gRemain.toFixed(2)} BF
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 items-center">
          <input value={budgetTotal} onChange={(e) => setBudgetTotal(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-40" placeholder="global budget BF" />
          <button onClick={saveBudget} className="px-4 py-2 rounded-xl bg-black text-white font-bold text-sm hover:bg-gray-800">Update Budget</button>
          <div className="text-xs text-gray-500">Status: {budget?.status || '-'}</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 font-bold mb-2">Select Pool</label>
            <select value={poolId} onChange={(e) => setPoolId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
              {pools.map(p => {
                const poolSponsor = (Number(p.sponsorAmount || 0) / 100).toFixed(2)
                const poolLimit = (Number(p.sponsorBudgetLimit || 0) / 100).toFixed(2)
                return (
                  <option key={p.id} value={p.id}>
                    {(p.team?.code || p.teamId)}.{p.stage} | Sponsor: {poolSponsor} / Limit: {poolLimit} BF
                  </option>
                )
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-bold mb-2">Amount (BF)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="10" />
          </div>
        </div>
        
        {poolId && (() => {
          const p = poolIndex.get(poolId)
          if (!p) return null
          const poolSponsor = Number(p.sponsorAmount || 0) / 100
          const poolLimit = Number(p.sponsorBudgetLimit || 0) / 100
          return (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <div>Sponsor Amount: <span className="font-bold text-blue-700">{poolSponsor.toFixed(2)} BF</span></div>
              <div>Sponsor Budget Limit: <span className="font-bold text-purple-700">{poolLimit.toFixed(2)} BF</span></div>
              {poolLimit > 0 && (
                <div>Remaining: <span className={`font-bold ${poolLimit - poolSponsor < 0 ? 'text-red-700' : 'text-gray-700'}`}>
                  {(poolLimit - poolSponsor).toFixed(2)} BF
                </span></div>
              )}
            </div>
          )
        })()}

        <div>
          <label className="block text-xs text-gray-500 font-bold mb-2">Reference <span className="text-red-500">*</span></label>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono" placeholder="sponsor_xxx" />
          <div className="text-xs text-gray-500 mt-1">
            Required. Duplicate reference will be rejected to prevent double-spending.
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 font-bold mb-2">Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="Official Sponsored" />
        </div>
        <button disabled={loading || !reference?.trim()} onClick={sponsor} className="w-full px-4 py-3 rounded-2xl bg-amber-500 text-white font-black hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed">
          Execute Sponsor Injection
        </button>
      </div>

      {result && (
        <div className={`border rounded-2xl p-5 shadow bg-white ${result.ok ? 'border-emerald-200' : 'border-red-200'}`}>
          <div className={`font-black ${result.ok ? 'text-emerald-700' : 'text-red-700'}`}>{result.ok ? 'Success' : 'Failed'}</div>
          <pre className="mt-3 text-xs text-slate-700 whitespace-pre-wrap break-words">{result.text}</pre>
        </div>
      )}
    </div>
  )
}
