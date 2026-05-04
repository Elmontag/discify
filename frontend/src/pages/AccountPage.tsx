import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Disc3,
  Lock,
  LogOut,
  Mail,
  Save,
  Trash2,
  User,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { UserMe } from '../api/types'

function formatDate(value?: string | null) {
  if (!value) return 'Unbekannt'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unbekannt' : date.toLocaleDateString('de-DE')
}

const tierStyles: Record<string, string> = {
  free: 'border-white/10 bg-white/6 text-[#9eaccf]',
  basic: 'border-[#00c2ff]/25 bg-[#00c2ff]/10 text-[#8ee8ff]',
  pro: 'border-[#ffd166]/25 bg-[#ffd166]/10 text-[#ffe29e]',
}

function CollapsibleSection({
  icon,
  iconColor,
  title,
  subtitle,
  defaultOpen = false,
  danger = false,
  children,
}: {
  icon: React.ReactNode
  iconColor?: string
  title: string
  subtitle?: string
  defaultOpen?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section
      className={`rounded-2xl border ${
        danger ? 'border-[#ff7a7a]/20 bg-[#ff7a7a]/4' : 'border-white/8 bg-white/3'
      } overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/3"
      >
        <span className={iconColor}>{icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${danger ? 'text-[#ffb0b0]' : 'text-[#f5f7ff]'}`}>{title}</p>
          {subtitle && <p className="text-xs text-[#9eaccf] mt-0.5">{subtitle}</p>}
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#9eaccf] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-white/6 px-4 pb-4 pt-3 space-y-3">
          {children}
        </div>
      )}
    </section>
  )
}

export default function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [account, setAccount] = useState<UserMe | null>(user)
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [discogsToken, setDiscogsToken] = useState('')
  const [discogsTokenSet, setDiscogsTokenSet] = useState(Boolean(user?.discogs_token_set))
  const [discogsUsername, setDiscogsUsername] = useState<string | null>(null)
  const [ollamaUrl, setOllamaUrl] = useState(user?.ollama_url ?? '')
  const [loading, setLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [discogsSaving, setDiscogsSaving] = useState(false)
  const [ollamaSaving, setOllamaSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [discogsError, setDiscogsError] = useState('')
  const [ollamaError, setOllamaError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [discogsSuccess, setDiscogsSuccess] = useState('')
  const [ollamaSuccess, setOllamaSuccess] = useState('')
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    setAccount(user)
    setDisplayName(user?.display_name ?? '')
    setEmail(user?.email ?? '')
    setOllamaUrl(user?.ollama_url ?? '')
    setDiscogsTokenSet(Boolean(user?.discogs_token_set))
  }, [user])

  useEffect(() => {
    async function loadSettings() {
      try {
        const [discogs, ollama] = await Promise.all([api.getDiscogsSettings(), api.getOllamaSettings()])
        setDiscogsTokenSet(discogs.discogs_token_set)
        setDiscogsUsername(discogs.discogs_username)
        setOllamaUrl(ollama.ollama_url || ollama.global_ollama_url || '')
      } catch (error) {
        setDiscogsError(error instanceof Error ? error.message : 'Kontoeinstellungen konnten nicht geladen werden.')
      } finally {
        setLoading(false)
      }
    }

    void loadSettings()
  }, [])

  const scanLimitLabel = useMemo(() => {
    if (!account) return '-'
    return account.scans_limit === -1 ? '∞' : String(account.scans_limit)
  }, [account])

  async function handleProfileSave() {
    if (!account) return
    setProfileSaving(true)
    setProfileError('')
    setProfileSuccess('')

    try {
      if (password && password !== passwordConfirm) {
        throw new Error('Passwörter stimmen nicht überein.')
      }

      const payload: { display_name?: string; email?: string; password?: string } = {}
      if (displayName !== (account.display_name ?? '')) payload.display_name = displayName
      if (email !== account.email) payload.email = email
      if (password) payload.password = password

      const updated = await api.updateProfile(payload)
      setAccount(updated)
      setDisplayName(updated.display_name ?? '')
      setEmail(updated.email)
      setPassword('')
      setPasswordConfirm('')

      if (updated.email !== account.email) {
        logout()
        window.alert('E-Mail geändert. Bitte mit der neuen Adresse erneut anmelden.')
        navigate('/login', { replace: true })
        return
      }

      setProfileSuccess('Profil gespeichert.')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Profil konnte nicht gespeichert werden.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleDiscogsSave() {
    setDiscogsSaving(true)
    setDiscogsError('')
    setDiscogsSuccess('')

    try {
      const updated = await api.updateDiscogsToken(discogsToken)
      const info = await api.getDiscogsSettings()
      setDiscogsToken('')
      setDiscogsTokenSet(updated.discogs_token_set)
      setDiscogsUsername(info.discogs_username)
      setAccount((prev) => (prev ? { ...prev, discogs_token_set: updated.discogs_token_set } : prev))
      setDiscogsSuccess('Discogs-Einstellungen gespeichert.')
    } catch (error) {
      setDiscogsError(error instanceof Error ? error.message : 'Discogs konnte nicht gespeichert werden.')
    } finally {
      setDiscogsSaving(false)
    }
  }

  async function handleOllamaSave() {
    setOllamaSaving(true)
    setOllamaError('')
    setOllamaSuccess('')

    try {
      const updated = await api.updateOllamaUrl(ollamaUrl)
      setOllamaUrl(updated.ollama_url)
      setAccount((prev) => (prev ? { ...prev, ollama_url: updated.ollama_url } : prev))
      setOllamaSuccess('Ollama-URL gespeichert.')
    } catch (error) {
      setOllamaError(error instanceof Error ? error.message : 'Ollama-URL konnte nicht gespeichert werden.')
    } finally {
      setOllamaSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (!account || deleteConfirmEmail !== account.email) return
    setDeleting(true)
    setDeleteError('')
    try {
      await api.deleteAccount()
      logout()
      navigate('/login', { replace: true })
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Konto konnte nicht gelöscht werden.')
      setDeleting(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#07111f]">
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[#07111f]/95 px-4 py-3 backdrop-blur-lg">
        <h1 className="text-lg font-bold text-[#f5f7ff]">Konto</h1>
        <p className="text-xs text-[#9eaccf]">{account?.email ?? ''}</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
        {/* Account Summary Banner */}
        <div className="flex items-center gap-4 border-b border-white/6 bg-white/2 px-4 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#7c5cff]/20 text-[#a88eff]">
            <User size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#f5f7ff] truncate">
              {account?.display_name || account?.email || '—'}
            </p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${tierStyles[account?.tier ?? 'free']}`}>
                {account?.tier ?? 'free'}
              </span>
              <span className="text-xs text-[#9eaccf]">
                {account?.scans_used ?? 0} / {scanLimitLabel} Scans
              </span>
              <span className="text-xs text-[#9eaccf]">
                Seit {formatDate(account?.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2 p-4">
          {/* Profil */}
          <CollapsibleSection
            icon={<User size={18} />}
            iconColor="text-[#7c5cff]"
            title="Profil"
            subtitle={account?.display_name ?? account?.email ?? ''}
          >
            {profileError && (
              <div className="flex items-center gap-2 rounded-xl border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 px-3 py-2 text-sm text-[#ffb0b0]">
                <AlertCircle size={16} /> {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-[#31d19b]/20 bg-[#31d19b]/10 px-3 py-2 text-sm text-[#86f0c9]">
                <CheckCircle2 size={16} /> {profileSuccess}
              </div>
            )}
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs uppercase tracking-wide text-[#9eaccf]">
                <User size={12} /> Anzeigename
              </span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                placeholder="Optional"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs uppercase tracking-wide text-[#9eaccf]">
                <Mail size={12} /> E-Mail
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
              />
            </label>
            <button
              type="button"
              onClick={handleProfileSave}
              disabled={profileSaving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
            >
              <Save size={15} />
              {profileSaving ? 'Speichert…' : 'Profil speichern'}
            </button>
          </CollapsibleSection>

          {/* Sicherheit */}
          <CollapsibleSection
            icon={<Lock size={18} />}
            iconColor="text-[#9eaccf]"
            title="Sicherheit"
            subtitle="Passwort ändern"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-[#9eaccf]">Neues Passwort</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                  placeholder="Mindestens 8 Zeichen"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wide text-[#9eaccf]">Passwort bestätigen</span>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleProfileSave}
              disabled={profileSaving || !password}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
            >
              <Save size={15} />
              {profileSaving ? 'Speichert…' : 'Passwort ändern'}
            </button>
          </CollapsibleSection>

          {/* Verbindungen */}
          <CollapsibleSection
            icon={<Disc3 size={18} />}
            iconColor="text-[#00c2ff]"
            title="Verbindungen"
            subtitle={
              loading ? 'Lädt…' :
              discogsTokenSet ? (discogsUsername ? `Discogs: ${discogsUsername}` : 'Discogs verbunden') : 'Discogs nicht verbunden'
            }
          >
            {/* Discogs */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9eaccf]">Discogs</p>
              {(discogsError || discogsSuccess) && (
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${discogsError ? 'border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 text-[#ffb0b0]' : 'border border-[#31d19b]/20 bg-[#31d19b]/10 text-[#86f0c9]'}`}>
                  {discogsError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                  {discogsError || discogsSuccess}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-[#9eaccf]">
                {loading ? <span>Lade Status…</span> : discogsTokenSet ? (
                  <><CheckCircle2 size={14} className="text-[#86f0c9]" /><span>{discogsUsername ? `Verbunden als ${discogsUsername}` : 'Token hinterlegt'}</span></>
                ) : (
                  <><AlertCircle size={14} className="text-[#ffd166]" /><span>Kein Token gespeichert</span></>
                )}
              </div>
              <input
                type="password"
                value={discogsToken}
                onChange={(e) => setDiscogsToken(e.target.value)}
                className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                placeholder={discogsTokenSet ? 'Neuen Token eingeben…' : 'Discogs-Token eingeben'}
              />
              <button
                type="button"
                onClick={handleDiscogsSave}
                disabled={discogsSaving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
              >
                <Save size={15} />
                {discogsSaving ? 'Speichert…' : 'Discogs speichern'}
              </button>
            </div>

            <div className="my-1 h-px bg-white/6" />

            {/* Ollama */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9eaccf]">Ollama (selbst gehostet)</p>
              {(ollamaError || ollamaSuccess) && (
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${ollamaError ? 'border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 text-[#ffb0b0]' : 'border border-[#31d19b]/20 bg-[#31d19b]/10 text-[#86f0c9]'}`}>
                  {ollamaError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                  {ollamaError || ollamaSuccess}
                </div>
              )}
              <input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                placeholder="http://localhost:11434"
              />
              <button
                type="button"
                onClick={handleOllamaSave}
                disabled={ollamaSaving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
              >
                <Save size={15} />
                {ollamaSaving ? 'Speichert…' : 'Ollama speichern'}
              </button>
            </div>
          </CollapsibleSection>

          {/* Abmelden */}
          <button
            type="button"
            onClick={() => { logout(); navigate('/login', { replace: true }) }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 py-3 text-sm font-semibold text-[#9eaccf] hover:bg-white/4 transition-colors"
          >
            <LogOut size={16} />
            Abmelden
          </button>

          {/* Gefahrenzone */}
          <CollapsibleSection
            icon={<Trash2 size={18} />}
            iconColor="text-[#ffb0b0]"
            title="Konto löschen"
            subtitle="Unwiderruflich – alle Daten werden gelöscht"
            danger
          >
            <p className="text-sm text-[#9eaccf]">
              Dein Konto und alle gespeicherten Scan-Daten werden unwiderruflich gelöscht. Gib zur Bestätigung deine E-Mail-Adresse ein.
            </p>
            {deleteError && (
              <div className="flex items-center gap-2 rounded-xl border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 px-3 py-2 text-sm text-[#ffb0b0]">
                <AlertCircle size={16} /> {deleteError}
              </div>
            )}
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-xs uppercase tracking-wide text-[#9eaccf]">
                <Mail size={12} /> E-Mail zur Bestätigung
              </span>
              <input
                type="email"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#ff7a7a]"
                placeholder={account?.email ?? ''}
              />
            </label>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleting || deleteConfirmEmail !== (account?.email ?? '')}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#ff7a7a]/30 bg-[#ff7a7a]/10 py-3 text-sm font-bold text-[#ffb0b0] disabled:opacity-40 hover:bg-[#ff7a7a]/15 transition-colors"
            >
              <Trash2 size={16} />
              {deleting ? 'Wird gelöscht…' : 'Konto unwiderruflich löschen'}
            </button>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  )
}
