import { useState, type FormEvent } from 'react'
import { Disc3, Lock, LogIn, Mail, UserPlus } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthPage() {
  const navigate = useNavigate()
  const { user, login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-[#07111f] px-4 py-8">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/4 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 rounded-3xl bg-[#7c5cff]/15 p-4 text-[#7c5cff]">
            <Disc3 size={36} strokeWidth={1.8} />
          </div>
          <h1 className="text-2xl font-bold text-[#f5f7ff]">Discify</h1>
          <p className="mt-2 text-sm text-[#9eaccf]">
            {mode === 'login'
              ? 'Melde dich an, um deine Sammlung zu verwalten.'
              : 'Erstelle dein Konto für Sammlung, Scans und Adminzugriff.'}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-2xl border border-white/10 bg-[#0d1e33] p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              mode === 'login' ? 'bg-[#7c5cff] text-white' : 'text-[#9eaccf]'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <LogIn size={16} />
              Login
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              mode === 'register' ? 'bg-[#7c5cff] text-white' : 'text-[#9eaccf]'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <UserPlus size={16} />
              Registrieren
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#9eaccf]">
              <Mail size={14} />
              E-Mail
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mail@beispiel.de"
              autoComplete="email"
              className="w-full rounded-2xl border border-white/10 bg-[#0d1e33] px-4 py-3 text-sm text-[#f5f7ff] outline-none transition focus:border-[#7c5cff]"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#9eaccf]">
              <Lock size={14} />
              Passwort
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 6 Zeichen"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full rounded-2xl border border-white/10 bg-[#0d1e33] px-4 py-3 text-sm text-[#f5f7ff] outline-none transition focus:border-[#7c5cff]"
              required
            />
          </label>

          {error && (
            <div className="rounded-2xl border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 p-3 text-sm text-[#ffb0b0]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
          >
            {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
            {loading ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : 'Registrieren'}
          </button>
        </form>
      </div>
    </div>
  )
}
