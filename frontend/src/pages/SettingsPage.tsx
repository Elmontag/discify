import { useEffect, useState } from 'react'
import { AlertCircle, Bot, CheckCircle2, ExternalLink, Key, Loader2, Save, Zap } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { HealthStatus, Models, Settings } from '../api/types'

export default function SettingsPage() {
  const { user } = useAuth()
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
    if (!user?.is_admin) {
      setError('Nur Admins können globale Einstellungen speichern.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = { ...settings }
      if (payload.anthropic_api_key === '***') {
        delete payload.anthropic_api_key
      }
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
      const h = await api.getHealth()
      setHealth(h)
    } catch {
      setHealth(null)
    } finally {
      setTesting(false)
    }
  }

  const isAnthropic = settings.vision_backend === 'anthropic'

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-[#7c5cff]" size={32} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#07111f]">
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[#07111f]/95 px-4 py-3 backdrop-blur-lg">
        <h1 className="text-lg font-bold text-[#f5f7ff]">Einstellungen</h1>
        <p className="text-xs text-[#9eaccf]">Globale Vision-Konfiguration</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
        {!user?.is_admin && (
          <div className="m-4 flex items-start gap-3 rounded-2xl border border-[#ffd166]/20 bg-[#ffd166]/8 p-4 text-sm text-[#ffe29e]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>Nur Admins können diese Einstellungen ändern. Lesbar für alle Nutzer.</span>
          </div>
        )}

        {error && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-2xl border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 p-4 text-sm text-[#ffb0b0]">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-3 p-4">
          {/* Vision Backend */}
          <section className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/6 px-4 py-3">
              <Bot size={18} className="text-[#7c5cff]" />
              <div>
                <p className="text-sm font-semibold text-[#f5f7ff]">Vision Backend</p>
                <p className="text-xs text-[#9eaccf]">Welche KI analysiert deine Fotos?</p>
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-2">
                {(['anthropic', 'ollama'] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    disabled={!user?.is_admin}
                    onClick={() => setSettings((s) => ({ ...s, vision_backend: b }))}
                    className={`rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
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
                    disabled={!user?.is_admin}
                    onChange={(e) => setSettings((s) => ({ ...s, anthropic_model: e.target.value }))}
                    className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff] disabled:opacity-60"
                  >
                    {models.anthropic.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-[#9eaccf]">Ollama URL</label>
                    <input
                      className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff] disabled:opacity-60"
                      value={settings.ollama_url || ''}
                      disabled={!user?.is_admin}
                      onChange={(e) => setSettings((s) => ({ ...s, ollama_url: e.target.value }))}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-[#9eaccf]">Modell</label>
                    <select
                      value={settings.ollama_model || ''}
                      disabled={!user?.is_admin}
                      onChange={(e) => setSettings((s) => ({ ...s, ollama_model: e.target.value }))}
                      className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff] disabled:opacity-60"
                    >
                      {models.ollama.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
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
                  disabled={!user?.is_admin}
                  className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff] disabled:opacity-60"
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
                    <CheckCircle2 size={13} />
                    Anthropic Key: {health.anthropic_key_set ? 'Gesetzt' : 'Nicht gesetzt'}
                  </div>
                  <div className="flex items-center gap-2 text-[#9eaccf]">
                    <CheckCircle2 size={13} />
                    Ollama URL: {health.ollama_url}
                  </div>
                  <div className="flex items-center gap-2 text-[#9eaccf]">
                    <CheckCircle2 size={13} />
                    Vision: {health.vision_backend} · {health.vision_model}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Save */}
          <button
            type="button"
            onClick={save}
            disabled={saving || !user?.is_admin}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-60 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : saved ? (
              <CheckCircle2 size={16} />
            ) : (
              <Save size={16} />
            )}
            {saving ? 'Speichert…' : saved ? 'Gespeichert!' : 'Einstellungen speichern'}
          </button>

          <p className="text-center text-xs text-[#9eaccf]">
            Globale API-Keys werden serverseitig gespeichert. Discogs und Ollama werden pro Benutzer im Konto gepflegt.
          </p>
        </div>
      </div>
    </div>
  )
}
