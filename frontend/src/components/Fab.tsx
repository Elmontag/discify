import { Plus } from 'lucide-react'

interface FabProps {
  onClick: () => void
}

export default function Fab({ onClick }: FabProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Hinzufügen"
      className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-[#7c5cff]/40 transition-transform active:scale-95 md:hidden"
      style={{
        background: 'linear-gradient(135deg, #7c5cff, #00c2ff)',
      }}
    >
      <Plus size={28} strokeWidth={2.5} className="text-white" />
    </button>
  )
}
