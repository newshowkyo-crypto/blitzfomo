import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/api'

const STATUSES = ['', 'PENDING', 'RELEASED', 'PAID', 'CANCELLED']

export default function RoadKOL() {
  const [summary, setSummary] = useState([])
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [sRes, cRes] = await Promise.all([
        adminFetch('/admin/api/road/kol/summary'),
        adminFetch(`/admin/api/road/kol/commissions${status ? `?status=${encodeURIComponent(status)}` : ''}`),
      ])
      if (sRes.ok) setSummary(await sRes.json())
      if (cRes.ok) setRows(await cRes.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status])

  const fmt = (v) => Number(v || 0) / 100

  const totalPending = summary.find(s => s.status === 'PENDING')?.amount || 0
  const totalReleased = summary.find(s => s.status === 'RELEASED')?.amount || 0
  const totalPaid = summary.find(s => s.status === 'PAID')?.amount || 0

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      RELEASED: 'bg-blue-100 text-blue-700',
      PAID: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-gray-100 text-gray-700',
    }
    return <span className={`text-xs px-2 py-1 rounded-full font-bold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">🤝 Road KOL / Agents</h2>
          <p className="text-sm text-gray-500 mt-1">Commission ledger (from AgentPool, delayed release)</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
            {STATUSES.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
          </select>
          <button onClick={load} className="px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-sm font-bold text-sm hover:bg-gray-50">Refresh</button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-4">
        <div className="text-xs text-purple-700 font-bold">💡 Commission comes from AgentPool and is released after delay</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow p-5">
          <div className="text-xs text-gray-500 font-bold">Pending Commission</div>
          <div className="text-2xl font-black text-yellow-700 mt-2">{fmt(totalPending).toFixed(2)} BF</div>
          <div className="text-xs text-gray-500 mt-1">Waiting for release</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl shadow p-5">
          <div className="text-xs text-gray-500 font-bold">Released Commission</div>
          <div className="text-2xl font-black text-blue-700 mt-2">{fmt(totalReleased).toFixed(2)} BF</div>
          <div className="text-xs text-gray-500 mt-1">Available for withdrawal</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl shadow p-5">
          <div className="text-xs text-gray-500 font-bold">Paid Commission</div>
          <div className="text-2xl font-black text-green-700 mt-2">{fmt(totalPaid).toFixed(2)} BF</div>
          <div className="text-xs text-gray-500 mt-1">Already paid out</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-gray-900">Commission Records</h3>
            <div className="text-xs text-gray-500">{loading ? 'Loading...' : `${rows.length} records`}</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Inviter</th>
                <th className="px-4 py-3">Referred</th>
                <th className="px-4 py-3">Purchase ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td className="px-4 py-8 text-gray-500 text-center" colSpan={6}>No records</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-xs">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                  <td className="px-4 py-3 font-bold text-gray-900">{fmt(r.commissionAmount).toFixed(2)} BF</td>
                  <td className="px-4 py-3">{r.inviter?.nickname || r.inviterId}</td>
                  <td className="px-4 py-3">{r.referredUser?.nickname || r.referredUserId}</td>
                  <td className="px-4 py-3 font-mono text-xs">{(r.purchaseId || '').slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

