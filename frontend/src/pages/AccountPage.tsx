import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Disc3,
  Lock,
  Mail,
  Save,
  Server,
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

  return (
    <div className="flex h-full flex-col bg-[#07111f]">
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[#07111f]/95 px-4 py-3 backdrop-blur-lg">
        <h1 className="text-lg font-bold text-[#f5f7ff]">Konto</h1>
        <p className="text-xs text-[#9eaccf]">Profil, Discogs und persönliche Ollama-Einstellungen</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-24">
        <section className="space-y-4 rounded-2xl border border-white/8 bg-white/3 p-4">
          <div className="flex items-center gap-2 text-[#f5f7ff]">
            <User size={18} className="text-[#7c5cff]" />
            <h2 className="text-sm font-bold uppercase tracking-wide">Profil</h2>
          </div>

          {profileError && (
            <div className="flex items-center gap-2 rounded-xl border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 px-3 py-2 text-sm text-[#ffb0b0]">
              <AlertCircle size={16} />
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-[#31d19b]/20 bg-[#31d19b]/10 px-3 py-2 text-sm text-[#86f0c9]">
              <CheckCircle2 size={16} />
              {profileSuccess}
            </div>
          )}

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-[#9eaccf]">
              <User size={14} /> Anzeigename
            </span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
              placeholder="Optional"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-[#9eaccf]">
              <Mail size={14} /> E-Mail
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-[#9eaccf]">
                <Lock size={14} /> Neues Passwort
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                placeholder="Mindestens 8 Zeichen"
              />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-[#9eaccf]">
                <Lock size={14} /> Passwort bestätigen
              </span>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={handleProfileSave}
            disabled={profileSaving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
          >
            <Save size={16} />
            {profileSaving ? 'Speichert…' : 'Profil speichern'}
          </button>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/8 bg-white/3 p-4">
          <div className="flex items-center gap-2 text-[#f5f7ff]">
            <Disc3 size={18} className="text-[#00c2ff]" />
            <h2 className="text-sm font-bold uppercase tracking-wide">Discogs</h2>
          </div>

          {(discogsError || discogsSuccess) && (
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                discogsError
                  ? 'border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 text-[#ffb0b0]'
                  : 'border border-[#31d19b]/20 bg-[#31d19b]/10 text-[#86f0c9]'
              }`}
            >
              {discogsError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              {discogsError || discogsSuccess}
            </div>
          )}

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-[#9eaccf]">
              <Lock size={14} /> Discogs Token
            </span>
            <input
              type="password"
              value={discogsToken}
              onChange={(event) => setDiscogsToken(event.target.value)}
              className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
              placeholder={discogsTokenSet ? 'Neuen Token eingeben oder leer speichern zum Entfernen' : 'Persönlichen Discogs-Token eingeben'}
            />
          </label>

          <div className="flex items-center gap-2 text-sm text-[#9eaccf]">
            {loading ? (
              <span>Lade Discogs-Status…</span>
            ) : discogsTokenSet ? (
              <>
                <CheckCircle2 size={16} className="text-[#86f0c9]" />
                <span>{discogsUsername ? `Verbunden als ${discogsUsername}` : 'Token hinterlegt'}</span>
              </>
            ) : (
              <>
                <AlertCircle size={16} className="text-[#ffd166]" />
                <span>Kein Discogs-Token gespeichert</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleDiscogsSave}
            disabled={discogsSaving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
          >
            <Save size={16} />
            {discogsSaving ? 'Speichert…' : 'Discogs speichern'}
          </button>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/8 bg-white/3 p-4">
          <div className="flex items-center gap-2 text-[#f5f7ff]">
            <Server size={18} className="text-[#7c5cff]" />
            <h2 className="text-sm font-bold uppercase tracking-wide">Ollama</h2>
          </div>

          {(ollamaError || ollamaSuccess) && (
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                ollamaError
                  ? 'border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 text-[#ffb0b0]'
                  : 'border border-[#31d19b]/20 bg-[#31d19b]/10 text-[#86f0c9]'
              }`}
            >
              {ollamaError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              {ollamaError || ollamaSuccess}
            </div>
          )}

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-[#9eaccf]">
              <Server size={14} /> Persönliche Ollama URL
            </span>
            <input
              value={ollamaUrl}
              onChange={(event) => setOllamaUrl(event.target.value)}
              className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
              placeholder="http://localhost:11434"
            />
          </label>

          <button
            type="button"
            onClick={handleOllamaSave}
            disabled={ollamaSaving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
          >
            <Save size={16} />
            {ollamaSaving ? 'Speichert…' : 'Ollama speichern'}
          </button>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/8 bg-white/3 p-4">
          <div className="flex items-center gap-2 text-[#f5f7ff]">
            <CheckCircle2 size={18} className="text-[#86f0c9]" />
            <h2 className="text-sm font-bold uppercase tracking-wide">Konto</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-[#0d1e33] p-3">
              <p className="text-xs uppercase tracking-wide text-[#9eaccf]">Tarif</p>
              <div className="mt-2">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${tierStyles[account?.tier ?? 'free']}`}>
                  {account?.tier ?? 'free'}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-[#0d1e33] p-3">
              <p className="text-xs uppercase tracking-wide text-[#9eaccf]">Scans</p>
              <p className="mt-2 text-sm font-semibold text-[#f5f7ff]">
                {account?.scans_used ?? 0} / {scanLimitLabel}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-[#0d1e33] p-3 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-[#9eaccf]">Mitglied seit</p>
              <p className="mt-2 text-sm font-semibold text-[#f5f7ff]">{formatDate(account?.created_at)}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
