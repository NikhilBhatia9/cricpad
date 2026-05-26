import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import MatchSetup from './pages/MatchSetup'
import Toss from './pages/Toss'
import Scoring from './pages/Scoring'
import InningsBreak from './pages/InningsBreak'
import Result from './pages/Result'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-900 text-white font-sans">
        <Routes>
          <Route path="/"              element={<Home />} />
          <Route path="/setup"         element={<MatchSetup />} />
          <Route path="/toss"          element={<Toss />} />
          <Route path="/scoring"       element={<Scoring />} />
          <Route path="/innings-break" element={<InningsBreak />} />
          <Route path="/result"        element={<Result />} />
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
