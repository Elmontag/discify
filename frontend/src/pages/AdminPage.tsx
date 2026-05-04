import { useEffect, useState } from 'react'
import { AlertCircle, Bot, CheckCircle2, Crown, Edit2, ExternalLink, Key, Loader2, Save, Shield, ShieldOff, Trash2, Users, Zap, type LucideIcon } from 'lucide-react'
import { api } from '../api/client'
import type { AdminUser, HealthStatus, Models, Settings } from '../api/types'
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

// ─── Settings Tab ───────────────────────────────────────────────────────────

function SystemSettings() {
  const [settings, setSettings] = useState<Partial<Settings>>({})
  const [models, setModels] = useState<Models>({ anthropic: [], ollama: [] })
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      try {
        const [s, m] = await Promise.all([api.getSettings(), api.getModels()])
        setSettings(s)
        setModels(m)
      } catch (e: unknown) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [])

  async function save() {
    setSaving(true)
    setError('')
    try {
      const payload = { ...settings }
      if (payload.anthropic_api_key === '***') delete payload.anthropic_api_key
      const updated = await api.updateSettings(payload)
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    try {
      setHealth(await api.getHealth())
    } catch {
      setHealth(null)
    } finally {
      setTesting(false)
    }
  }

  const isAnthropic = settings.vision_backend === 'anthropic'

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="animate-spin text-[#7c5cff]" size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 p-4 text-sm text-[#ffb0b0]">
          <AlertCircle size={15} className="shrink-0" /> {error}
        </div>
      )}

      {/* Vision Backend */}
      <section className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/6 px-4 py-3">
          <Bot size={18} className="text-[#7c5cff]" />
          <div>
            <p className="text-sm font-semibold text-[#f5f7ff]">Vision Backend</p>
            <p className="text-xs text-[#9eaccf]">Welche KI analysiert Fotos?</p>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            {(['anthropic', 'ollama'] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setSettings((s) => ({ ...s, vision_backend: b }))}
                className={`rounded-xl py-3 text-sm font-semibold transition-colors ${
                  settings.vision_backend === b
                    ? 'text-white'
                    : 'border border-white/10 bg-white/4 text-[#9eaccf] hover:bg-white/8'
                }`}
                style={settings.vision_backend === b ? { background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' } : {}}
              >
                {b === 'anthropic' ? 'Anthropic Claude' : 'Ollama lokal'}
              </button>
            ))}
          </div>
          {isAnthropic ? (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[#9eaccf]">Modell</label>
              <select
                value={settings.anthropic_model || ''}
                onChange={(e) => setSettings((s) => ({ ...s, anthropic_model: e.target.value }))}
                className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
              >
                {models.anthropic.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-[#9eaccf]">Ollama URL</label>
                <input
                  className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                  value={settings.ollama_url || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, ollama_url: e.target.value }))}
                  placeholder="http://localhost:11434"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-[#9eaccf]">Modell</label>
                <select
                  value={settings.ollama_model || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, ollama_model: e.target.value }))}
                  className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                >
                  {models.ollama.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* API Key */}
      <section className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/6 px-4 py-3">
          <Key size={18} className="text-[#00c2ff]" />
          <div>
            <p className="text-sm font-semibold text-[#f5f7ff]">Anthropic API Key</p>
            <p className="text-xs text-[#9eaccf]">Serverseitig gespeichert – nie im Client</p>
          </div>
        </div>
        <div className="p-4">
          {settings.anthropic_api_key_set && settings.anthropic_api_key === '***' ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#31d19b]/20 bg-[#31d19b]/10 px-3 py-2.5">
              <CheckCircle2 size={15} className="shrink-0 text-[#86f0c9]" />
              <span className="text-xs text-[#86f0c9]">Key aus Umgebungsvariable aktiv (ANTHROPIC_API_KEY)</span>
            </div>
          ) : (
            <input
              type="password"
              className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
              placeholder={settings.anthropic_api_key_set ? 'Key hinterlegt – neu eingeben zum Überschreiben' : 'sk-ant-…'}
              value={settings.anthropic_api_key && settings.anthropic_api_key !== '***' ? settings.anthropic_api_key : ''}
              onChange={(e) => setSettings((s) => ({ ...s, anthropic_api_key: e.target.value }))}
            />
          )}
          <a
            href="https://console.anthropic.com/account/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1 text-xs text-[#9eaccf] hover:text-[#f5f7ff] transition-colors"
          >
            <ExternalLink size={11} /> console.anthropic.com
          </a>
        </div>
      </section>

      {/* Connection Test */}
      <section className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/6 px-4 py-3">
          <Zap size={18} className="text-[#ffd166]" />
          <div>
            <p className="text-sm font-semibold text-[#f5f7ff]">Verbindungstest</p>
            <p className="text-xs text-[#9eaccf]">Aktiven Vision-Backend prüfen</p>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <button
            type="button"
            onClick={testConnection}
            disabled={testing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/4 py-2.5 text-sm font-semibold text-[#9eaccf] hover:bg-white/8 transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {testing ? 'Teste…' : 'Verbindung testen'}
          </button>
          {health && (
            <div className="space-y-1.5 rounded-xl bg-white/3 p-3 text-xs">
              <div className={`flex items-center gap-2 ${health.anthropic_key_set ? 'text-[#86f0c9]' : 'text-[#ffd166]'}`}>
                <CheckCircle2 size={13} /> Anthropic Key: {health.anthropic_key_set ? 'Gesetzt' : 'Nicht gesetzt'}
              </div>
              <div className="flex items-center gap-2 text-[#9eaccf]">
                <CheckCircle2 size={13} /> Ollama URL: {health.ollama_url}
              </div>
              <div className="flex items-center gap-2 text-[#9eaccf]">
                <CheckCircle2 size={13} /> Vision: {health.vision_backend} · {health.vision_model}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Save */}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-60 transition-opacity"
        style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
        {saving ? 'Speichert…' : saved ? 'Gespeichert!' : 'Einstellungen speichern'}
      </button>
      <p className="text-center text-xs text-[#9eaccf]">
        Nur für Admins sichtbar. API-Keys werden serverseitig gespeichert.
      </p>
    </div>
  )
}

// ─── User Management Tab ────────────────────────────────────────────────────

type Tab = 'users' | 'settings'

interface TabButtonProps { label: string; icon: LucideIcon; active: boolean; onClick: () => void }
function TabButton({ label, icon: Icon, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
        active ? 'bg-[#7c5cff]/20 text-[#a990ff]' : 'text-[#9eaccf] hover:bg-white/6 hover:text-[#f5f7ff]'
      }`}
    >
      <Icon size={16} strokeWidth={1.8} />
      {label}
    </button>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('users')
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
            <p className="text-xs text-[#9eaccf]">Benutzer, Rollen und Systemkonfiguration</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[#ffd166]/20 bg-[#ffd166]/10 px-3 py-1 text-xs font-semibold text-[#ffe29e] sm:flex">
            <Crown size={14} />
            {user?.email}
          </div>
        </div>
        {/* Tab bar */}
        <div className="mt-3 flex gap-1">
          <TabButton label="Benutzer" icon={Users} active={tab === 'users'} onClick={() => setTab('users')} />
          <TabButton label="Systemeinstellungen" icon={Key} active={tab === 'settings'} onClick={() => setTab('settings')} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6">
        {tab === 'settings' ? (
          <SystemSettings />
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
