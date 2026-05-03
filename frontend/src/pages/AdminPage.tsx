import { useEffect, useState } from 'react'
import { Crown, Edit2, Shield, ShieldOff, Trash2, Users } from 'lucide-react'
import { api } from '../api/client'
import type { AdminUser } from '../api/types'
import { useAuth } from '../context/AuthContext'

const tierStyles: Record<string, string> = {
  free: 'border-white/10 bg-white/6 text-[#9eaccf]',
  basic: 'border-[#00c2ff]/25 bg-[#00c2ff]/10 text-[#8ee8ff]',
  pro: 'border-[#ffd166]/25 bg-[#ffd166]/10 text-[#ffe29e]',
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('de-DE')
}

export default function AdminPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadUsers() {
      try {
        setError('')
        setUsers(await api.adminListUsers())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Benutzer konnten nicht geladen werden.')
      } finally {
        setLoading(false)
      }
    }

    void loadUsers()
  }, [])

  async function handleUpdate(id: number, update: { tier?: 'free' | 'basic' | 'pro'; is_admin?: boolean }) {
    setBusyId(id)
    setError('')

    try {
      const updated = await api.adminUpdateUser(id, update)
      setUsers((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benutzer konnte nicht aktualisiert werden.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(item: AdminUser) {
    if (!window.confirm(`Benutzer ${item.email} wirklich löschen?`)) {
      return
    }

    setBusyId(item.id)
    setError('')

    try {
      await api.adminDeleteUser(item.id)
      setUsers((prev) => prev.filter((entry) => entry.id !== item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benutzer konnte nicht gelöscht werden.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7c5cff] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#07111f]">
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[#07111f]/95 px-4 py-3 backdrop-blur-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold text-[#f5f7ff]">
              <Users size={20} className="text-[#7c5cff]" />
              Admin
            </h1>
            <p className="text-xs text-[#9eaccf]">Benutzer, Rollen und Zugriffsrechte verwalten</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[#ffd166]/20 bg-[#ffd166]/10 px-3 py-1 text-xs font-semibold text-[#ffe29e] sm:flex">
            <Crown size={14} />
            {user?.email}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {error && (
          <div className="mb-4 rounded-2xl border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 p-4 text-sm text-[#ffb0b0]">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {users.map((item) => {
            const isBusy = busyId === item.id

            return (
              <section
                key={item.id}
                className="rounded-2xl border border-white/8 bg-white/3 p-4 shadow-lg shadow-black/10"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-[#f5f7ff]">{item.email}</p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${tierStyles[item.tier]}`}
                      >
                        {item.tier}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          item.is_admin
                            ? 'border-[#7c5cff]/25 bg-[#7c5cff]/10 text-[#b8a7ff]'
                            : 'border-white/10 bg-white/5 text-[#9eaccf]'
                        }`}
                      >
                        {item.is_admin ? <Shield size={12} /> : <ShieldOff size={12} />}
                        {item.is_admin ? 'Admin' : 'Kein Admin'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#9eaccf]">
                      <span>Scans: {item.scans_used}</span>
                      <span>Erstellt: {formatDate(item.created_at)}</span>
                      <span>ID: {item.id}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0d1e33] px-3 py-2 text-sm text-[#f5f7ff]">
                      <Edit2 size={14} className="text-[#9eaccf]" />
                      <select
                        value={item.tier}
                        disabled={isBusy}
                        onChange={(e) =>
                          void handleUpdate(item.id, {
                            tier: e.target.value as 'free' | 'basic' | 'pro',
                          })
                        }
                        className="bg-transparent text-sm outline-none"
                      >
                        <option value="free">free</option>
                        <option value="basic">basic</option>
                        <option value="pro">pro</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleUpdate(item.id, { is_admin: !item.is_admin })}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                        item.is_admin
                          ? 'bg-[#7c5cff]/15 text-[#b8a7ff] hover:bg-[#7c5cff]/25'
                          : 'bg-white/6 text-[#9eaccf] hover:bg-white/10 hover:text-[#f5f7ff]'
                      }`}
                    >
                      {item.is_admin ? <ShieldOff size={15} /> : <Shield size={15} />}
                      {item.is_admin ? 'Admin entfernen' : 'Admin setzen'}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleDelete(item)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff7a7a]/12 px-3 py-2 text-sm font-semibold text-[#ffb0b0] transition hover:bg-[#ff7a7a]/18 disabled:opacity-60"
                    >
                      <Trash2 size={15} />
                      Löschen
                    </button>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
