import { Disc3, Settings, Users, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface NavItem {
  to: string
  label: string
  Icon: LucideIcon
}

const baseNavItems: NavItem[] = [
  { to: '/', label: 'Sammlung', Icon: Disc3 },
  { to: '/settings', label: 'Einstellungen', Icon: Settings },
]

export default function BottomNav() {
  const { user } = useAuth()
  const navItems = user?.is_admin
    ? [...baseNavItems, { to: '/admin', label: 'Admin', Icon: Users }]
    : baseNavItems

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#07111f]/95 backdrop-blur-lg safe-area-inset-bottom">
      <div className="flex">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                isActive
                  ? 'text-[#7c5cff]'
                  : 'text-[#9eaccf] hover:text-[#f5f7ff]'
              }`
            }
          >
            <Icon size={22} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
