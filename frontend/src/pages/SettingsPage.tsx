import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, Save } from 'lucide-react'
import { api } from '../api/client'
import type { HealthStatus, Models, Settings } from '../api/types'

export default function SettingsPage() {
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
    init()
  }, [])

  async function save() {
    setSaving(true)
    setError('')
    try {
      const updated = await api.updateSettings(settings)
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
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[#07111f]/95 backdrop-blur-lg px-4 py-3">
        <h1 className="text-lg font-bold text-[#f5f7ff]">Einstellungen</h1>
        <p className="text-xs text-[#9eaccf]">API-Keys und Vision-Konfiguration</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {error && (
          <div className="rounded-2xl border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 p-4 text-sm text-[#ffb0b0]">
            {error}
          </div>
        )}

        {/* Vision Backend */}
        <section className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
          <h2 className="text-sm font-bold text-[#f5f7ff] uppercase tracking-wide">Vision Backend</h2>
          <div className="grid grid-cols-2 gap-2">
            {(['anthropic', 'ollama'] as const).map((b) => (
              <button
                key={b}
                onClick={() => setSettings((s) => ({ ...s, vision_backend: b }))}
                className={`rounded-xl py-3 text-sm font-semibold transition-colors ${
                  settings.vision_backend === b
                    ? 'text-white'
                    : 'border border-white/10 bg-white/4 text-[#9eaccf]'
                }`}
                style={
                  settings.vision_backend === b
                    ? { background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }
                    : {}
                }
              >
                {b === 'anthropic' ? 'Anthropic Claude' : 'Ollama lokal'}
              </button>
            ))}
          </div>

          {isAnthropic ? (
            <div>
              <label className="text-xs text-[#9eaccf] uppercase tracking-wide">Modell</label>
              <select
                value={settings.anthropic_model || ''}
                onChange={(e) => setSettings((s) => ({ ...s, anthropic_model: e.target.value }))}
                className="mt-1 w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
              >
                {models.anthropic.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-[#9eaccf] uppercase tracking-wide">Ollama URL</label>
                <input
                  className="mt-1 w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                  value={settings.ollama_url || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, ollama_url: e.target.value }))}
                  placeholder="http://localhost:11434"
                />
              </div>
              <div>
                <label className="text-xs text-[#9eaccf] uppercase tracking-wide">Modell</label>
                <select
                  value={settings.ollama_model || ''}
                  onChange={(e) => setSettings((s) => ({ ...s, ollama_model: e.target.value }))}
                  className="mt-1 w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                >
                  {models.ollama.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </section>

        {/* API Keys */}
        <section className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
          <h2 className="text-sm font-bold text-[#f5f7ff] uppercase tracking-wide">API Keys</h2>

          <div>
            <label className="text-xs text-[#9eaccf] uppercase tracking-wide">
              Anthropic API Key
              {settings.anthropic_api_key_set && (
                <span className="ml-2 text-[#86f0c9]">✓ aktiv</span>
              )}
            </label>
            {settings.anthropic_api_key_set && settings.anthropic_api_key === '***' ? (
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-[#31d19b]/10 border border-[#31d19b]/20 px-3 py-2">
                <span className="text-xs text-[#86f0c9]">Key aus Umgebungsvariable aktiv (ANTHROPIC_API_KEY)</span>
              </div>
            ) : (
              <input
                type="password"
                className="mt-1 w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                placeholder="sk-ant-…"
                value={settings.anthropic_api_key || ''}
                onChange={(e) => setSettings((s) => ({ ...s, anthropic_api_key: e.target.value }))}
              />
            )}
            <a
              href="https://console.anthropic.com/account/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-[#9eaccf] hover:text-[#f5f7ff]"
            >
              <ExternalLink size={11} /> console.anthropic.com
            </a>
          </div>

          <div>
            <label className="text-xs text-[#9eaccf] uppercase tracking-wide">
              Discogs Personal Access Token
              {settings.discogs_token_set && (
                <span className="ml-2 text-[#86f0c9]">✓ aktiv</span>
              )}
            </label>
            {settings.discogs_token_set && settings.discogs_token === '***' ? (
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-[#31d19b]/10 border border-[#31d19b]/20 px-3 py-2">
                <span className="text-xs text-[#86f0c9]">Token aus Umgebungsvariable aktiv (DISCOGS_TOKEN)</span>
              </div>
            ) : (
              <input
                type="password"
                className="mt-1 w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                placeholder="Discogs Token…"
                value={settings.discogs_token || ''}
                onChange={(e) => setSettings((s) => ({ ...s, discogs_token: e.target.value }))}
              />
            )}
            <a
              href="https://www.discogs.com/settings/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-[#9eaccf] hover:text-[#f5f7ff]"
            >
              <ExternalLink size={11} /> discogs.com/settings/developers
            </a>
          </div>
        </section>

        {/* Health / Connection test */}
        <section className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
          <h2 className="text-sm font-bold text-[#f5f7ff] uppercase tracking-wide">Verbindungstest</h2>
          <button
            onClick={testConnection}
            disabled={testing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/4 py-2.5 text-sm font-semibold text-[#9eaccf] disabled:opacity-50"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : null}
            {testing ? 'Teste…' : 'Verbindung testen'}
          </button>

          {health && (
            <div className="space-y-2 text-sm">
              <div className={`flex items-center gap-2 ${health.discogs_connected ? 'text-[#86f0c9]' : 'text-[#ffb0b0]'}`}>
                <CheckCircle2 size={14} />
                Discogs: {health.discogs_connected ? `Verbunden als ${health.discogs_username}` : 'Nicht verbunden'}
              </div>
              <div className={`flex items-center gap-2 ${health.anthropic_key_set ? 'text-[#86f0c9]' : 'text-[#ffd166]'}`}>
                <CheckCircle2 size={14} />
                Anthropic Key: {health.anthropic_key_set ? 'Gesetzt' : 'Nicht gesetzt'}
              </div>
              <div className="text-[#9eaccf] flex items-center gap-2">
                <CheckCircle2 size={14} />
                Vision: {health.vision_backend} · {health.vision_model}
              </div>
            </div>
          )}
        </section>

        {/* Save button */}
        <button
          onClick={save}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white disabled:opacity-60"
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
          Keys werden lokal in settings.json gespeichert und nicht übertragen.
        </p>
      </div>
    </div>
  )
}
