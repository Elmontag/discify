import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import AlbumCard from '../components/AlbumCard'
import { api } from '../api/client'
import type { Release } from '../api/types'

export default function CollectionPage() {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [username, setUsername] = useState('')

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getCollection(p, 50)
      setReleases((prev) => (p === 1 ? data.releases : [...prev, ...data.releases]))
      setTotalPages(data.pagination.pages)
      setPage(p)
      setUsername(data.username)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(1)
  }, [load])

  const filtered = releases.filter((r) => {
    if (!query) return true
    const q = query.toLowerCase()
    return r.title.toLowerCase().includes(q) || r.artist.toLowerCase().includes(q)
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[#07111f]/95 backdrop-blur-lg px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-[#f5f7ff]">Sammlung</h1>
            {username && (
              <p className="text-xs text-[#9eaccf]">
                {releases.length} Releases · {username}
              </p>
            )}
          </div>
          <button
            onClick={() => load(1)}
            disabled={loading}
            className="flex items-center gap-1 rounded-full bg-white/6 px-3 py-1.5 text-xs font-semibold text-[#9eaccf] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Aktualisieren
          </button>
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9eaccf]" />
          <input
            type="search"
            placeholder="Artist oder Album suchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl bg-white/6 py-2 pl-9 pr-3 text-sm text-[#f5f7ff] placeholder-[#9eaccf] outline-none focus:ring-1 focus:ring-[#7c5cff]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {error && (
          <div className="mb-4 rounded-2xl border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 p-4 text-sm text-[#ffb0b0]">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 text-5xl">💿</div>
            <h2 className="mb-2 text-lg font-bold text-[#f5f7ff]">
              {query ? 'Keine Treffer' : 'Sammlung ist leer'}
            </h2>
            <p className="max-w-xs text-sm text-[#9eaccf]">
              {query
                ? 'Versuche einen anderen Suchbegriff.'
                : 'Tippe auf den + Button, um dein erstes Foto zu analysieren.'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((r) => (
            <AlbumCard key={r.instance_id ?? r.release_id} release={r} />
          ))}
        </div>

        {page < totalPages && !query && (
          <button
            onClick={() => load(page + 1)}
            disabled={loading}
            className="mt-6 w-full rounded-2xl border border-white/10 bg-white/4 py-3 text-sm font-semibold text-[#9eaccf] disabled:opacity-50"
          >
            {loading ? 'Lädt …' : 'Mehr laden'}
          </button>
        )}
      </div>
    </div>
  )
}
