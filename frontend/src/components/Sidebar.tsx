import { Clock, Disc3, LogOut, Plus, Users, type LucideIcon } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface NavItem {
  to: string
  label: string
  Icon: LucideIcon
}

const baseNavItems: NavItem[] = [
  { to: '/', label: 'Sammlung', Icon: Disc3 },
  { to: '/history', label: 'Verlauf', Icon: Clock },
]

interface SidebarProps {
  onScan: () => void
}

export default function Sidebar({ onScan }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const navItems: NavItem[] = user?.is_admin
    ? [...baseNavItems, { to: '/admin', label: 'Admin', Icon: Users }]
    : baseNavItems

  const initials = (user?.display_name || user?.email || '?')
    .split(/[\s@]/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 w-16 lg:w-56 flex-col border-r border-white/10 bg-[#07111f]/95 backdrop-blur-lg">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-5 lg:px-5">
        <Disc3 size={26} className="shrink-0 text-[#7c5cff]" strokeWidth={1.8} />
        <span className="hidden lg:block text-base font-bold text-[#f5f7ff] tracking-tight">
          Discify
        </span>
      </div>

      {/* Scan button */}
      <div className="px-2 pb-4 lg:px-4">
        <button
          onClick={onScan}
          title="Hinzufügen"
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-lg shadow-[#7c5cff]/30 transition-transform active:scale-95 hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
        >
          <Plus size={18} strokeWidth={2.5} className="shrink-0" />
          <span className="hidden lg:block">Hinzufügen</span>
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 lg:px-3">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={label}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-[#7c5cff]/15 text-[#a990ff]'
                  : 'text-[#9eaccf] hover:bg-white/5 hover:text-[#f5f7ff]'
              }`
            }
          >
            <Icon size={20} strokeWidth={1.8} className="shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-white/8 p-2 lg:p-3 flex flex-col gap-0.5">
        <NavLink
          to="/account"
          title="Konto"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors ${
              isActive
                ? 'bg-[#7c5cff]/15 text-[#a990ff]'
                : 'text-[#9eaccf] hover:bg-white/5 hover:text-[#f5f7ff]'
            }`
          }
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7c5cff]/30 text-xs font-bold text-[#a990ff]">
            {initials}
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="truncate text-xs font-bold text-[#f5f7ff] leading-tight">
              {user?.display_name || user?.email}
            </p>
            {user?.display_name && (
              <p className="truncate text-xs text-[#9eaccf] leading-tight">{user.email}</p>
            )}
          </div>
        </NavLink>

        <button
          onClick={handleLogout}
          title="Abmelden"
          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold text-[#9eaccf] hover:bg-white/5 hover:text-[#ff7a7a] transition-colors"
        >
          <LogOut size={18} strokeWidth={1.8} className="shrink-0" />
          <span className="hidden lg:block text-sm">Abmelden</span>
        </button>
      </div>
    </aside>
  )
}
