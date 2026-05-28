import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import MatchSetup from './pages/MatchSetup'
import Toss from './pages/Toss'
import Scoring from './pages/Scoring'
import InningsBreak from './pages/InningsBreak'
import Result from './pages/Result'
import Players from './pages/Players'
import PlayerDetail from './pages/PlayerDetail'
import PlayerComparison from './pages/PlayerComparison'
import MatchHistory from './pages/MatchHistory'
import JoinMatch from './pages/JoinMatch'
import Teams from './pages/Teams'
import Tournaments from './pages/Tournaments'
import SyncManager from './components/SyncManager'
import { useTheme } from './hooks/useTheme'
import { trackPageView } from './utils/analytics'

function RouteTracker() {
  const location = useLocation()
  useEffect(() => {
    trackPageView(location.pathname)
  }, [location.pathname])
  return null
}

export default function App() {
  useTheme()
  return (
    <BrowserRouter basename="/social-cricket-scorer">
      <SyncManager />
      <RouteTracker />
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white font-sans">
        <Routes>
          <Route path="/"                        element={<Home />} />
          <Route path="/setup"                   element={<MatchSetup />} />
          <Route path="/toss"                    element={<Toss />} />
          <Route path="/scoring"                 element={<Scoring />} />
          <Route path="/innings-break"           element={<InningsBreak />} />
          <Route path="/result"                  element={<Result />} />
          <Route path="/players"                 element={<Players />} />
          <Route path="/players/:name"           element={<PlayerDetail />} />
          <Route path="/compare/:nameA/:nameB"   element={<PlayerComparison />} />
          <Route path="/history"                 element={<MatchHistory />} />
          <Route path="/history/:id"             element={<MatchHistory />} />
          <Route path="/join"                    element={<JoinMatch />} />
          <Route path="/teams"                   element={<Teams />} />
          <Route path="/tournaments"             element={<Tournaments />} />
          <Route path="*"                        element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
