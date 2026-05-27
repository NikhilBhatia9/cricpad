import { useNavigate } from 'react-router-dom'
import { useMatchStore } from '../store/matchStore'
import { isSupabaseConfigured } from '../config/supabase'
import { useTheme } from '../hooks/useTheme'

export default function Home() {
  const navigate = useNavigate()
  const { match, resetMatch } = useMatchStore()
  const { dark, toggle } = useTheme()

  const hasActiveMatch = match && match.status !== 'complete'

  function resumeMatch() {
    if (!match) return
    if (match.status === 'toss') navigate('/toss')
    else if (match.status === 'innings_break') navigate('/innings-break')
    else navigate('/scoring')
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="relative overflow-hidden px-6 pt-16 pb-10 text-center bg-gradient-to-b from-green-900/20 to-gray-50 dark:from-green-950/60 dark:to-gray-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(22,163,74,0.10),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_50%_0%,rgba(22,163,74,0.15),transparent_70%)]" />
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="absolute top-4 right-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
          aria-label="Toggle theme"
        >
          {dark ? '☀️' : '🌙'}
        </button>
        <div className="relative">
          <img
            src="/social-cricket-scorer/icons/icon.svg"
            alt="Cricket Scorer icon"
            className="w-28 h-28 mx-auto mb-4 drop-shadow-xl rounded-3xl"
          />
          <h1 className="text-3xl font-bold tracking-tight">Cricket Scorer</h1>
          <p className="text-green-600 dark:text-green-400 text-sm font-semibold mt-1.5 tracking-wide italic">Built for bragging rights!</p>
        </div>
      </div>

      {/* Supabase not configured warning */}
      {!isSupabaseConfigured && (
        <div className="mx-5 mt-4 bg-yellow-900/40 border border-yellow-700/60 rounded-xl px-4 py-3 text-sm text-yellow-300 text-center">
          ⚠️ Database not connected — add <strong>VITE_SUPABASE_URL</strong> &amp; <strong>VITE_SUPABASE_ANON_KEY</strong> as GitHub secrets to enable player &amp; match history.
        </div>
      )}

      {/* Actions */}
      <div className="flex-1 px-5 pb-10 pt-5 flex flex-col gap-3 max-w-md mx-auto w-full">

        {/* Active match banner */}
        {hasActiveMatch && (
          <div className="bg-green-900/25 border border-green-700/40 rounded-2xl px-4 py-3.5 mb-1">
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
              <span className="text-xs text-gray-500">{match.maxOvers} overs</span>
            </div>
            <p className="font-bold text-base">{match.teams[0].name} <span className="text-gray-500">vs</span> {match.teams[1].name}</p>
          </div>
        )}

        {/* Primary CTA */}
        {hasActiveMatch ? (
          <>
            <button className="btn-primary flex items-center justify-center gap-2" onClick={resumeMatch}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              Resume Match
            </button>
            <button className="btn-secondary flex items-center justify-center gap-2" onClick={() => { resetMatch(); navigate('/setup') }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              New Match
            </button>
          </>
        ) : (
          <button className="btn-primary text-xl py-4 flex items-center justify-center gap-2" onClick={() => navigate('/setup')}>
            🏏 Start New Match
          </button>
        )}

        {match?.status === 'complete' && (
          <button className="btn-secondary flex items-center justify-center gap-2" onClick={() => navigate('/result')}>
            🏆 View Last Result
          </button>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700/60" />
          <span className="text-xs text-gray-400 dark:text-gray-600 font-semibold tracking-widest uppercase">Explore</span>
          <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700/60" />
        </div>

        {/* Nav cards */}
        <div className="grid grid-cols-2 gap-3">
          <NavCard icon="👥" title="Players" subtitle="Career stats" onClick={() => navigate('/players')} />
          <NavCard icon="📊" title="History" subtitle="Past matches" onClick={() => navigate('/history')} />
        </div>
        <NavCard
          icon="🔗"
          title="Join a Match"
          subtitle="Score from your own device"
          onClick={() => navigate('/join')}
          horizontal
        />
      </div>
    </div>
  )
}

function NavCard({
  icon, title, subtitle, onClick, horizontal = false,
}: {
  icon: string; title: string; subtitle: string; onClick: () => void; horizontal?: boolean
}) {
  const chevron = (
    <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )

  if (horizontal) {
    return (
      <button
        onClick={onClick}
        className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700/80 rounded-2xl p-4 flex items-center gap-4 transition-colors active:scale-[0.98]"
      >
        <span className="text-3xl">{icon}</span>
        <div className="text-left flex-1">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        {chevron}
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700/80 rounded-2xl p-4 flex flex-col items-center gap-2 transition-colors active:scale-[0.98]"
    >
      <span className="text-3xl">{icon}</span>
      <div className="text-center">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
      </div>
    </button>
  )
}

