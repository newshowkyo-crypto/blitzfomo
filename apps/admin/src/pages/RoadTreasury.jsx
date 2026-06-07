import { useEffect, useMemo, useState } from 'react'
import { adminFetch } from '../lib/api'

export default function RoadTreasury() {
  const [buckets, setBuckets] = useState([])
  const [reconcile, setReconcile] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [bucket, setBucket] = useState('')
  const [eventType, setEventType] = useState('')
  const [eventId, setEventId] = useState('')
  const [poolId, setPoolId] = useState('')

  const bucketMap = useMemo(() => {
    const m = new Map()
    for (const b of buckets) m.set(b.bucket, b.amount)
    return m
  }, [buckets])

  const load = async () => {
    setLoading(true)
    try {
      const [bRes, rRes] = await Promise.all([
        adminFetch('/admin/api/road/treasury/buckets'),
        adminFetch('/admin/api/road/treasury/reconcile'),
      ])
      if (bRes.ok) setBuckets(await bRes.json())
      if (rRes.ok) setReconcile(await rRes.json())
    } finally {
      setLoading(false)
    }
  }

  const loadEntries = async () => {
    const qs = new URLSearchParams()
    if (bucket) qs.set('bucket', bucket)
    if (eventType) qs.set('eventType', eventType)
    if (eventId) qs.set('eventId', eventId)
    if (poolId) qs.set('poolId', poolId)
    qs.set('limit', '100')
    const res = await adminFetch(`/admin/api/road/treasury/entries?${qs.toString()}`)
    if (!res.ok) { setEntries([]); return }
    setEntries(await res.json())
  }

  useEffect(() => { load() }, [])

  const fmt = (v) => Number(v || 0) / 100

  const totalOrphans = reconcile ? (
    (reconcile.orphan?.pools?.length || 0) + 
    (reconcile.orphan?.purchases?.length || 0) + 
    (reconcile.orphan?.sponsors?.length || 0) + 
    (reconcile.orphan?.dividends?.length || 0)
  ) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">📚 Road Treasury</h2>
          <p className="text-sm text-gray-500 mt-1">Bucket summary, entries query, reconcile status</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={load} className="px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-sm font-bold text-sm hover:bg-gray-50">Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-900">Bucket Totals</h3>
            <div className="text-xs text-gray-500">{loading ? 'loading…' : ''}</div>
          </div>
          {buckets.length === 0 ? (
            <div className="text-gray-500 text-sm">No data</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {buckets.map((b) => (
                <div key={b.bucket} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 font-mono truncate">{b.bucket}</div>
                  <div className="font-bold text-gray-900 mt-1">{fmt(b.amount).toFixed(2)} BF</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`bg-white border rounded-2xl shadow p-5 ${reconcile?.ok ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-900">Reconcile Status</h3>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${reconcile?.ok ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'}`}>
              {reconcile ? (reconcile.ok ? '✅ OK' : '❌ NOT OK') : 'loading...'}
            </span>
          </div>
          {reconcile ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">SuperJackpot Diff</span>
                <span className={`font-bold ${Math.abs(Number(reconcile.diffs?.superJackpot?.diff || 0)) > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                  {fmt(reconcile.diffs?.superJackpot?.diff).toFixed(2)} BF
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Pool Prize Diffs</span>
                <span className={`font-bold ${reconcile.diffs?.poolPrize?.length ? 'text-red-700' : 'text-gray-700'}`}>
                  {reconcile.diffs?.poolPrize?.length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Pending Reward Diffs</span>
                <span className={`font-bold ${reconcile.diffs?.pendingReward?.length ? 'text-red-700' : 'text-gray-700'}`}>
                  {reconcile.diffs?.pendingReward?.length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Orphans</span>
                <span className={`font-bold ${totalOrphans ? 'text-red-700' : 'text-gray-700'}`}>
                  {totalOrphans}
                </span>
              </div>
              
              {totalOrphans > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 mb-2">Orphan Details:</div>
                  <div className="text-xs space-y-1">
                    {reconcile.orphan?.pools?.length > 0 && (
                      <div className="text-red-600">• Pools: {reconcile.orphan.pools.length}</div>
                    )}
                    {reconcile.orphan?.purchases?.length > 0 && (
                      <div className="text-red-600">• Purchases: {reconcile.orphan.purchases.length}</div>
                    )}
                    {reconcile.orphan?.sponsors?.length > 0 && (
                      <div className="text-red-600">• Sponsors: {reconcile.orphan.sponsors.length}</div>
                    )}
                    {reconcile.orphan?.dividends?.length > 0 && (
                      <div className="text-red-600">• Dividends: {reconcile.orphan.dividends.length}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">Loading...</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-5">
        <h3 className="font-black text-gray-900 mb-4">Entries Query</h3>
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <select value={bucket} onChange={(e) => setBucket(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">All buckets</option>
            {Array.from(bucketMap.keys()).sort().map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="eventType" className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          <input value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="eventId" className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          <input value={poolId} onChange={(e) => setPoolId(e.target.value)} placeholder="poolId" className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          <button onClick={loadEntries} className="px-4 py-2 rounded-xl bg-black text-white font-bold text-sm hover:bg-gray-800">Search</button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Bucket</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Refs</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td className="px-4 py-8 text-gray-500 text-center" colSpan={5}>No entries</td></tr>
              ) : entries.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-xs">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.bucket}</td>
                  <td className="px-4 py-3 font-bold text-gray-900">{fmt(e.amount).toFixed(2)} BF</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.eventType}:{e.eventId}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {(e.poolId || '').slice(0, 8)} {(e.purchaseId || '').slice(0, 8)} {(e.sponsorLedgerId || '').slice(0, 8)} {(e.dividendId || '').slice(0, 8)}
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

