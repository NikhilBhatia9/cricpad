import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import MatchSetup from './pages/MatchSetup'
import Toss from './pages/Toss'
import Scoring from './pages/Scoring'
import InningsBreak from './pages/InningsBreak'
import Result from './pages/Result'
import Players from './pages/Players'
import PlayerDetail from './pages/PlayerDetail'
import MatchHistory from './pages/MatchHistory'

export default function App() {
  return (
    <BrowserRouter basename="/social-cricket-scorer">
      <div className="min-h-screen bg-gray-900 text-white font-sans">
        <Routes>
          <Route path="/"                  element={<Home />} />
          <Route path="/setup"             element={<MatchSetup />} />
          <Route path="/toss"              element={<Toss />} />
          <Route path="/scoring"           element={<Scoring />} />
          <Route path="/innings-break"     element={<InningsBreak />} />
          <Route path="/result"            element={<Result />} />
          <Route path="/players"           element={<Players />} />
          <Route path="/players/:name"     element={<PlayerDetail />} />
          <Route path="/history"           element={<MatchHistory />} />
          <Route path="/history/:id"       element={<MatchHistory />} />
          <Route path="*"                  element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
