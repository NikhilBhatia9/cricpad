interface BackButtonProps {
  onClick: () => void
  label?: string
}

export default function BackButton({ onClick, label = 'Back' }: BackButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm font-medium py-1"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  )
}
