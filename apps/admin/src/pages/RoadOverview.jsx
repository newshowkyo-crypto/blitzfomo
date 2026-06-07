import { useEffect, useState } from 'react'
import { adminFetch } from '../lib/api'

const ECONOMY_MODE_INFO = {
  COLD_START: { label: 'Cold Start', color: 'bg-blue-500', description: '高分红吸引早期用户', icon: '🌡️' },
  NORMAL_GROWTH: { label: 'Normal Growth', color: 'bg-green-500', description: '平衡增长模式', icon: '📈' },
  KNOCKOUT_FOMO: { label: 'Knockout FOMO', color: 'bg-orange-500', description: '淘汰赛阶段', icon: '⚔️' },
  FINAL_RUSH: { label: 'Final Rush', color: 'bg-red-500', description: '决赛冲刺阶段', icon: '🏁' },
}

export default function RoadOverview({ token }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/admin/api/road/overview')
      if (!res.ok) { setData(null); return }
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  const coverageRatio = data?.reserveCoverageRatio ?? 0
  const isLowCoverage = coverageRatio < 1
  const economyMode = data?.roadConfig?.economyMode
  const eco = data?.economy

  const getRecommendedMode = () => {
    if (!eco) return null
    const { reserveCoverage, volumeGrowth, withdrawalPressure } = eco
    if (volumeGrowth < 0.8 && reserveCoverage >= 1) {
      return { mode: 'COLD_START', reason: '流量较低但储备健康，建议使用高分红吸引用户' }
    }
    if (volumeGrowth >= 0.8 && volumeGrowth <= 1.3 && reserveCoverage >= 0.8) {
      return { mode: 'NORMAL_GROWTH', reason: '流量稳定，建议使用平衡增长模式' }
    }
    if (withdrawalPressure > 0.3) {
      return { mode: 'KNOCKOUT_FOMO', reason: '提现压力较高，建议降低分红' }
    }
    return { mode: 'NORMAL_GROWTH', reason: '当前状态适合平衡增长模式' }
  }

  const recommended = getRecommendedMode()
  const isRecommendedMatch = recommended && economyMode === recommended.mode

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">🏆 Road to Champion 运营总览</h2>
          <p className="text-sm text-gray-500 mt-1">Road to Champion 资金总览（内部总账口径）</p>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800">刷新</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-900">🌍 当前经济模式</h3>
            {economyMode && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${ECONOMY_MODE_INFO[economyMode]?.color}`}>
                {ECONOMY_MODE_INFO[economyMode]?.icon} {ECONOMY_MODE_INFO[economyMode]?.label}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 font-bold">动态分红率</div>
              <div className="text-2xl font-black text-green-600 mt-1">
                {loading ? '...' : `${(eco?.finalDividendBps / 100)?.toFixed(1)}%`}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 font-bold">超级池率</div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {loading ? '...' : `${(eco?.finalSuperBps / 100)?.toFixed(1)}%`}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 font-bold">平台费率</div>
              <div className="text-2xl font-black text-purple-600 mt-1">
                {loading ? '...' : `${(eco?.finalHouseFeeBps / 100)?.toFixed(1)}%`}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 font-bold">释放周期</div>
              <div className="text-2xl font-black text-blue-600 mt-1">
                {loading ? '...' : `${eco?.releaseDelayHours}h`}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-900">📊 动态分配 BPS</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${(data?.totalNetBps ?? 0) === 10000 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              Total: {(data?.totalNetBps ?? 0) === 10000 ? '✓' : '✗'} {data?.totalNetBps ?? '-'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4">
              <div className="text-xs text-blue-600 font-bold">奖池 BPS</div>
              <div className="text-2xl font-black text-blue-600 mt-1">
                {loading ? '...' : `${data?.finalPrizeBps ?? '-'}`}
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4">
              <div className="text-xs text-orange-600 font-bold">每日冲刺 BPS</div>
              <div className="text-2xl font-black text-orange-600 mt-1">
                {loading ? '...' : `${data?.finalDailyRushBps ?? '-'}`}
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4">
              <div className="text-xs text-purple-600 font-bold">超级池 BPS</div>
              <div className="text-2xl font-black text-purple-600 mt-1">
                {loading ? '...' : `${data?.finalMegaPoolBps ?? '-'}`}
              </div>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-4">
              <div className="text-xs text-slate-600 font-bold">净分配 BPS</div>
              <div className="text-2xl font-black text-slate-600 mt-1">
                {loading ? '...' : `${data?.finalNetBps ?? '-'}`}
              </div>
            </div>
          </div>
        </div>

        <div className={`bg-white border rounded-2xl shadow p-6 ${isRecommendedMatch ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-gray-900">💡 建议模式</h3>
            {recommended && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${ECONOMY_MODE_INFO[recommended.mode]?.color}`}>
                {ECONOMY_MODE_INFO[recommended.mode]?.icon} {ECONOMY_MODE_INFO[recommended.mode]?.label}
              </span>
            )}
          </div>
          {recommended ? (
            <>
              <div className="text-sm text-gray-700 mb-4">{recommended.reason}</div>
              {isRecommendedMatch ? (
                <div className="text-green-700 text-sm font-bold flex items-center gap-2">
                  <span>✅</span> 当前模式与建议一致
                </div>
              ) : (
                <div className="text-amber-700 text-sm font-bold flex items-center gap-2">
                  <span>⚠️</span> 当前模式与建议不一致，建议切换
                </div>
              )}
            </>
          ) : (
            <div className="text-gray-500 text-sm">加载中...</div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">储备覆盖率</div>
              <div className={`text-lg font-bold ${(eco?.reserveCoverage ?? 0) < 1 ? 'text-red-600' : 'text-gray-900'}`}>
                {loading ? '...' : `${(eco?.reserveCoverage * 100)?.toFixed(0)}%`}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">流量增长</div>
              <div className={`text-lg font-bold ${(eco?.volumeGrowth ?? 0) < 0.8 ? 'text-blue-600' : (eco?.volumeGrowth ?? 0) > 1.2 ? 'text-green-600' : 'text-gray-900'}`}>
                {loading ? '...' : `${(eco?.volumeGrowth * 100)?.toFixed(0)}%`}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">提现压力</div>
              <div className={`text-lg font-bold ${(eco?.withdrawalPressure ?? 0) > 0.3 ? 'text-red-600' : 'text-gray-900'}`}>
                {loading ? '...' : `${(eco?.withdrawalPressure * 100)?.toFixed(0)}%`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow">
          <div className="text-xs text-gray-500 font-bold">Total Purchases</div>
          <div className="text-3xl font-black text-gray-900 mt-2">{loading ? '...' : (data?.totalPurchases ?? 0).toFixed(2)} BF</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow">
          <div className="text-xs text-gray-500 font-bold">House Fee Income</div>
          <div className="text-3xl font-black text-amber-700 mt-2">{loading ? '...' : (data?.platformFeeIncome ?? 0).toFixed(2)} BF</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow">
          <div className="text-xs text-gray-500 font-bold">Platform Carry</div>
          <div className="text-3xl font-black text-purple-700 mt-2">{loading ? '...' : (data?.platformCarry ?? 0).toFixed(2)} BF</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow">
          <div className="text-xs text-gray-500 font-bold">Sponsor Cost</div>
          <div className="text-3xl font-black text-blue-700 mt-2">{loading ? '...' : (data?.officialSponsorCost ?? 0).toFixed(2)} BF</div>
          {!loading && <div className="text-xs text-gray-500 mt-1">累计注入: {(data?.officialSponsored ?? 0).toFixed(2)} BF</div>}
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow">
          <div className="text-xs text-gray-500 font-bold">Pending Liability</div>
          <div className="text-3xl font-black text-red-700 mt-2">{loading ? '...' : (data?.pendingRewardLiability ?? 0).toFixed(2)} BF</div>
        </div>
        <div className={`bg-white border rounded-2xl p-5 shadow ${isLowCoverage ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
          <div className="text-xs text-gray-500 font-bold">Reserve Coverage</div>
          <div className={`text-3xl font-black mt-2 ${isLowCoverage ? 'text-red-700' : 'text-slate-900'}`}>
            {loading ? '...' : ((coverageRatio) * 100).toFixed(1)}%
          </div>
          {!loading && (
            <>
              <div className="text-xs text-gray-500 mt-1">储备余额: {(data?.reserveBalance ?? 0).toFixed(2)} BF</div>
              {isLowCoverage && <div className="text-xs text-red-600 mt-1 font-bold">⚠️ 覆盖率低于 100%，需关注</div>}
            </>
          )}
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-5 shadow">
          <div className="text-xs text-amber-700 font-bold">Super Champion Pool</div>
          <div className="text-3xl font-black text-amber-700 mt-2">{loading ? '...' : (data?.superJackpot ?? 0).toFixed(2)} BF</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow">
          <div className="text-xs text-gray-500 font-bold">Estimated Net</div>
          <div className="text-3xl font-black text-slate-900 mt-2">{loading ? '...' : (data?.netProfit ?? 0).toFixed(2)} BF</div>
          {!loading && <div className="text-xs text-orange-600 mt-1">*非立即可提现金额</div>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 font-bold">Estimated Net 计算说明</div>
          <div className="text-xs text-orange-600 font-bold">*非立即可提现</div>
        </div>
        {!loading && (
          <div className="text-xs text-gray-600 mt-3 space-y-2">
            <div>Estimated Net = HouseFeeIncome + PlatformCarry + ReserveSurplus - SponsorCost - PendingLiabilityRisk</div>
            <div className="pt-2 border-t border-gray-100 text-gray-500">
              • HouseFeeIncome: {(data?.platformFeeIncome ?? 0).toFixed(2)} BF<br/>
              • PlatformCarry: {(data?.platformCarry ?? 0).toFixed(2)} BF<br/>
              • ReserveSurplus: {(data?.reserveSurplus ?? 0).toFixed(2)} BF<br/>
              • SponsorCost: {(data?.officialSponsorCost ?? 0).toFixed(2)} BF<br/>
              • PendingLiabilityRisk: {(data?.pendingRewardLiabilityRisk ?? 0).toFixed(2)} BF
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500">
        {loading ? '' : `更新时间: ${new Date(data?.timestamp || Date.now()).toLocaleString('zh-CN')}`}
      </div>
    </div>
  )
}