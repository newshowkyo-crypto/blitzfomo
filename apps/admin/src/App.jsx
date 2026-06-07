import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import GameConfig from './pages/GameConfig'
import Withdrawals from './pages/Withdrawals'
import Users from './pages/Users'
import Payments from './pages/Payments'
import RiskConfig from './pages/RiskConfig'
import BotConfig from './pages/BotConfig'
import Locales from './pages/Locales'
import AuditLogs from './pages/AuditLogs'
import Rounds from './pages/Rounds'
import SystemLogs from './pages/SystemLogs'
import LiveMonitor from './pages/LiveMonitor'
import RoadOverview from './pages/RoadOverview'
import RoadTeams from './pages/RoadTeams'
import RoadPools from './pages/RoadPools'
import RoadResults from './pages/RoadResults'
import RoadSponsor from './pages/RoadSponsor'
import RoadLiability from './pages/RoadLiability'
import RoadTreasury from './pages/RoadTreasury'
import RoadConfig from './pages/RoadConfig'
import RoadKOL from './pages/RoadKOL'
import Layout from './components/Layout'

function App() {
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '')
  // 启动时若已有 token，先校验其是否仍然有效，避免失效 token 直接进入后台
  const [validating, setValidating] = useState(!!localStorage.getItem('admin_token'))

  const login = (newToken) => {
    localStorage.setItem('admin_token', newToken)
    setToken(newToken)
  }

  const logout = () => {
    // 退出登录必须彻底清除 token
    localStorage.removeItem('admin_token')
    setToken('')
  }

  // 校验启动时已存在的 token；失效则清除并回到登录页
  useEffect(() => {
    let cancelled = false
    const existing = localStorage.getItem('admin_token')
    if (!existing) {
      setValidating(false)
      return
    }
    fetch('/admin/api/auth/me', { headers: { Authorization: `Bearer ${existing}` } })
      .then((res) => {
        if (cancelled) return
        if (!res.ok) logout()
      })
      .catch(() => {
        // 网络错误不强制登出，保留登录态由后续请求自然处理
      })
      .finally(() => {
        if (!cancelled) setValidating(false)
      })
    return () => { cancelled = true }
  }, [])

  // 任意页面请求遇到 401/403 时统一登出
  useEffect(() => {
    const onUnauthorized = () => logout()
    window.addEventListener('admin:unauthorized', onUnauthorized)
    return () => window.removeEventListener('admin:unauthorized', onUnauthorized)
  }, [])

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">
        正在校验登录状态...
      </div>
    )
  }

  if (!token) {
    return <Login onLogin={login} />
  }

  return (
    <Layout onLogout={logout}>
      <Routes>
        <Route path="/" element={<Dashboard token={token} />} />
        <Route path="/live-monitor" element={<LiveMonitor token={token} />} />
        <Route path="/road-overview" element={<RoadOverview token={token} />} />
        <Route path="/road-teams" element={<RoadTeams token={token} />} />
        <Route path="/road-pools" element={<RoadPools token={token} />} />
        <Route path="/road-results" element={<RoadResults token={token} />} />
        <Route path="/road-sponsor" element={<RoadSponsor token={token} />} />
        <Route path="/road-liability" element={<RoadLiability token={token} />} />
        <Route path="/road-treasury" element={<RoadTreasury token={token} />} />
        <Route path="/road-config" element={<RoadConfig token={token} />} />
        <Route path="/road-kol" element={<RoadKOL token={token} />} />
        <Route path="/config" element={<GameConfig token={token} />} />
        <Route path="/users" element={<Users token={token} />} />
        <Route path="/withdrawals" element={<Withdrawals token={token} />} />
        <Route path="/payments" element={<Payments token={token} />} />
        <Route path="/rounds" element={<Rounds token={token} />} />
        <Route path="/bot-config" element={<BotConfig token={token} />} />
        <Route path="/risk-config" element={<RiskConfig token={token} />} />
        <Route path="/locales" element={<Locales token={token} />} />
        <Route path="/audit-logs" element={<AuditLogs token={token} />} />
        <Route path="/system-logs" element={<SystemLogs token={token} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}

export default App
