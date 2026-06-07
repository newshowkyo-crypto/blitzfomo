import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/api'

const ECONOMY_MODES = [
  { value: 'COLD_START', label: 'Cold Start', description: '高分红吸引早期用户' },
  { value: 'NORMAL_GROWTH', label: 'Normal Growth', description: '平衡增长模式' },
  { value: 'KNOCKOUT_FOMO', label: 'Knockout FOMO', description: '淘汰赛阶段' },
  { value: 'FINAL_RUSH', label: 'Final Rush', description: '决赛冲刺阶段' },
]

export default function RoadConfig() {
  const [cfg, setCfg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = async () => {
    setErr('')
    const res = await adminFetch('/admin/api/road/config')
    if (!res.ok) { setCfg(null); return }
    setCfg(await res.json())
  }

  useEffect(() => { load() }, [])

  const setField = (k, v) => setCfg((prev) => ({ ...prev, [k]: v }))

  const save = async () => {
    setSaving(true)
    setErr('')
    try {
      const body = {
        economyMode: cfg.economyMode,
        
        baseHouseFeeBps: Number(cfg.baseHouseFeeBps),
        minHouseFeeBps: Number(cfg.minHouseFeeBps),
        maxHouseFeeBps: Number(cfg.maxHouseFeeBps),
        
        baseDividendBps: Number(cfg.baseDividendBps),
        minDividendBps: Number(cfg.minDividendBps),
        maxDividendBps: Number(cfg.maxDividendBps),
        
        prizeBps: Number(cfg.prizeBps),
        superBps: Number(cfg.superBps),
        reinvestBps: Number(cfg.reinvestBps),
        agentBps: Number(cfg.agentBps),
        reserveBps: Number(cfg.reserveBps),
        
        minSuperBps: Number(cfg.minSuperBps),
        maxSuperBps: Number(cfg.maxSuperBps),
        minReserveBps: Number(cfg.minReserveBps),
        maxReserveBps: Number(cfg.maxReserveBps),
        
        dailyRushBps: Number(cfg.dailyRushBps),
        megaPoolBps: Number(cfg.megaPoolBps),
        
        withdrawalPressureThresholdBps: Number(cfg.withdrawalPressureThresholdBps),
        volumeGrowthBoostCapBps: Number(cfg.volumeGrowthBoostCapBps),
        
        releaseDelayHours: Number(cfg.releaseDelayHours),
        releaseDelayMinHours: Number(cfg.releaseDelayMinHours),
        releaseDelayMaxHours: Number(cfg.releaseDelayMaxHours),
        
        lowCoverageThresholdBps: Number(cfg.lowCoverageThresholdBps),
        sponsorGlobalBudget: String(cfg.sponsorGlobalBudget || '0'),
      }
      const res = await adminFetch('/admin/api/road/config', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setErr(data?.message ? JSON.stringify(data.message) : JSON.stringify(data || {}))
        return
      }
      setCfg(data)
    } finally {
      setSaving(false)
    }
  }

  if (!cfg) {
    return (
      <div className="space-y-4">
        <h2 className="text-3xl font-black text-gray-900">⚙️ RoadConfig</h2>
        <button onClick={load} className="px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-sm font-bold text-sm hover:bg-gray-50">刷新</button>
      </div>
    )
  }

  const netSplitSum = Number(cfg.prizeBps) + Number(cfg.baseDividendBps) + Number(cfg.superBps) + Number(cfg.reinvestBps) + Number(cfg.agentBps) + Number(cfg.reserveBps)
  const isValidSplit = netSplitSum === 10000

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900">⚙️ Road Config</h2>
          <p className="text-sm text-gray-500 mt-1">Dynamic economy parameters for Road to Champion</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-sm font-bold text-sm hover:bg-gray-50">Refresh</button>
          <button disabled={saving || !isValidSplit} onClick={save} className="px-4 py-2 rounded-xl bg-black text-white font-bold text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
        </div>
      </div>

      {err && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <div className="font-bold mb-1">Error:</div>
          {err}
        </div>
      )}

      <div className={`p-4 rounded-xl border ${isValidSplit ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className={`text-sm font-bold ${isValidSplit ? 'text-green-700' : 'text-red-700'}`}>
          {isValidSplit ? '✅ Net Split Sum is Valid' : '❌ Net Split Sum is Invalid'}
        </div>
        <div className="text-xs mt-1 text-gray-600">
          Net Split = prizeBps + baseDividendBps + superBps + reinvestBps + agentBps + reserveBps = {netSplitSum} / 10000
          {!isValidSplit && (
            <span className="block mt-1 text-red-600">Please adjust values so the sum equals 10000</span>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
        <h3 className="font-black text-gray-900 mb-4">🌍 Economy Mode</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {ECONOMY_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setField('economyMode', mode.value)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                cfg.economyMode === mode.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`font-bold text-sm ${cfg.economyMode === mode.value ? 'text-blue-700' : 'text-gray-700'}`}>
                {mode.label}
              </div>
              <div className="text-xs text-gray-500 mt-1">{mode.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
        <h3 className="font-black text-gray-900 mb-4">💰 House Fee Settings (bps)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="minHouseFeeBps (Minimum)" value={cfg.minHouseFeeBps} onChange={(v) => setField('minHouseFeeBps', v)} />
          <Field label="baseHouseFeeBps (Base)" value={cfg.baseHouseFeeBps} onChange={(v) => setField('baseHouseFeeBps', v)} />
          <Field label="maxHouseFeeBps (Maximum)" value={cfg.maxHouseFeeBps} onChange={(v) => setField('maxHouseFeeBps', v)} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
        <h3 className="font-black text-gray-900 mb-4">📈 Dividend Settings (bps)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="minDividendBps (Minimum)" value={cfg.minDividendBps} onChange={(v) => setField('minDividendBps', v)} />
          <Field label="baseDividendBps (Base)" value={cfg.baseDividendBps} onChange={(v) => setField('baseDividendBps', v)} />
          <Field label="maxDividendBps (Maximum)" value={cfg.maxDividendBps} onChange={(v) => setField('maxDividendBps', v)} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
        <h3 className="font-black text-gray-900 mb-4">📊 Net Split Allocation (bps)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="prizeBps (Prize Pool)" value={cfg.prizeBps} onChange={(v) => setField('prizeBps', v)} />
          <Field label="baseDividendBps (Dividend)" value={cfg.baseDividendBps} onChange={(v) => setField('baseDividendBps', v)} />
          <Field label="superBps (Super Pool)" value={cfg.superBps} onChange={(v) => setField('superBps', v)} />
          <Field label="reinvestBps (Reinvest)" value={cfg.reinvestBps} onChange={(v) => setField('reinvestBps', v)} />
          <Field label="agentBps (Agent/Referral)" value={cfg.agentBps} onChange={(v) => setField('agentBps', v)} />
          <Field label="reserveBps (Reserve)" value={cfg.reserveBps} onChange={(v) => setField('reserveBps', v)} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
        <h3 className="font-black text-gray-900 mb-4">🎯 Dynamic Range Limits (bps)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs text-gray-500 font-bold">Super Pool Range</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="minSuperBps" value={cfg.minSuperBps} onChange={(v) => setField('minSuperBps', v)} />
              <Field label="maxSuperBps" value={cfg.maxSuperBps} onChange={(v) => setField('maxSuperBps', v)} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-gray-500 font-bold">Reserve Range</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="minReserveBps" value={cfg.minReserveBps} onChange={(v) => setField('minReserveBps', v)} />
              <Field label="maxReserveBps" value={cfg.maxReserveBps} onChange={(v) => setField('maxReserveBps', v)} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
        <h3 className="font-black text-gray-900 mb-4">🎁 Special Allocation (bps)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="dailyRushBps (Daily Rush Bonus)" value={cfg.dailyRushBps} onChange={(v) => setField('dailyRushBps', v)} />
          <Field label="megaPoolBps (Mega Pool Bonus)" value={cfg.megaPoolBps} onChange={(v) => setField('megaPoolBps', v)} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
        <h3 className="font-black text-gray-900 mb-4">📉 Pressure & Growth Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="withdrawalPressureThresholdBps" value={cfg.withdrawalPressureThresholdBps} onChange={(v) => setField('withdrawalPressureThresholdBps', v)} />
          <Field label="volumeGrowthBoostCapBps" value={cfg.volumeGrowthBoostCapBps} onChange={(v) => setField('volumeGrowthBoostCapBps', v)} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
        <h3 className="font-black text-gray-900 mb-4">⏱️ Release Delay Settings (hours)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="releaseDelayMinHours (Minimum)" value={cfg.releaseDelayMinHours} onChange={(v) => setField('releaseDelayMinHours', v)} />
          <Field label="releaseDelayHours (Base)" value={cfg.releaseDelayHours} onChange={(v) => setField('releaseDelayHours', v)} />
          <Field label="releaseDelayMaxHours (Maximum)" value={cfg.releaseDelayMaxHours} onChange={(v) => setField('releaseDelayMaxHours', v)} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
        <h3 className="font-black text-gray-900 mb-4">⚠️ Risk Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="lowCoverageThresholdBps" value={cfg.lowCoverageThresholdBps} onChange={(v) => setField('lowCoverageThresholdBps', v)} />
          <Field label="sponsorGlobalBudget (min unit)" value={cfg.sponsorGlobalBudget} onChange={(v) => setField('sponsorGlobalBudget', v)} />
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <label className="block">
      <div className="text-xs text-gray-500 font-bold mb-1">{label}</div>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
      />
    </label>
  )
}