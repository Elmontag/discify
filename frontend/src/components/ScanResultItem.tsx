import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Disc3, Search, X } from 'lucide-react'
import type { ScanResult } from '../api/types'
import { api } from '../api/client'

interface Props {
  item: ScanResult
  collectionIds: Set<number>
  onChange: (updated: ScanResult) => void
  onRemove: () => void
}

const STATUS_STYLES = {
  new: 'bg-[#31d19b]/15 text-[#86f0c9] border-[#31d19b]/25',
  in_collection: 'bg-[#ffd166]/15 text-[#ffe29e] border-[#ffd166]/25',
  not_found: 'bg-[#ff7a7a]/15 text-[#ffb0b0] border-[#ff7a7a]/25',
}

const STATUS_LABELS = {
  new: 'Neu',
  in_collection: 'In Sammlung',
  not_found: 'Nicht gefunden',
}

export default function ScanResultItem({ item, collectionIds, onChange, onRemove }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [manualQuery, setManualQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const thumb = item.thumb_url || item.cover_url

  async function runManualSearch() {
    setSearching(true)
    setSearchError('')
    try {
      const query = manualQuery || `${item.recognized_artist} ${item.recognized_album}`.trim()
      const hit = await api.discogsManualSearch(query)
      const inCollection = collectionIds.has(hit.release_id)
      onChange({
        ...item,
        found: true,
        discogs_title: hit.title,
        discogs_artist: hit.artist,
        release_id: hit.release_id,
        master_id: hit.master_id,
        year: hit.year ? String(hit.year) : '',
        cover_url: hit.cover_url,
        thumb_url: hit.thumb_url,
        in_collection: inCollection,
        status: inCollection ? 'in_collection' : 'new',
        include: !inCollection,
      })
    } catch {
      setSearchError('Kein Treffer gefunden.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/6">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#9eaccf]">
              <Disc3 size={24} strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span
            className={`mb-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[item.status]}`}
          >
            {STATUS_LABELS[item.status]}
          </span>
          <p className="truncate text-sm font-bold text-[#f5f7ff]">
            {item.recognized_artist || '—'} — {item.recognized_album || '—'}
          </p>
          {item.found && (
            <p className="truncate text-xs text-[#9eaccf]">{item.discogs_title}</p>
          )}
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 text-[#9eaccf]"
          aria-label="Toggle details"
        >
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-white/8 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[#9eaccf] uppercase tracking-wide">Artist</label>
              <input
                className="mt-1 w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                value={item.recognized_artist}
                onChange={(e) => onChange({ ...item, recognized_artist: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-[#9eaccf] uppercase tracking-wide">Album</label>
              <input
                className="mt-1 w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                value={item.recognized_album}
                onChange={(e) => onChange({ ...item, recognized_album: e.target.value })}
              />
            </div>
          </div>

          {!item.found && (
            <div className="space-y-2">
              <p className="text-xs text-[#ffd166]">Kein automatischer Treffer – manuelle Suche:</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                  placeholder={`${item.recognized_artist} ${item.recognized_album}`.trim()}
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runManualSearch()}
                />
                <button
                  onClick={runManualSearch}
                  disabled={searching}
                  className="flex items-center gap-1 rounded-xl bg-[#7c5cff]/20 px-3 py-2 text-sm font-semibold text-[#a88eff] disabled:opacity-50"
                >
                  <Search size={14} />
                  {searching ? '...' : 'Suchen'}
                </button>
              </div>
              {searchError && <p className="text-xs text-[#ff7a7a]">{searchError}</p>}
            </div>
          )}

          {item.found && item.year && (
            <p className="text-xs text-[#9eaccf]">
              {item.discogs_artist && `${item.discogs_artist} · `}Jahr: {item.year}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() =>
                  item.status !== 'in_collection' &&
                  onChange({ ...item, include: !item.include })
                }
                className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                  item.include
                    ? 'border-[#7c5cff] bg-[#7c5cff]'
                    : 'border-white/20 bg-white/5'
                } ${item.status === 'in_collection' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {item.include && <Check size={12} className="text-white" />}
              </div>
              <span className="text-sm text-[#f5f7ff]">Zur Sammlung hinzufügen</span>
            </label>
            <button
              onClick={onRemove}
              className="flex items-center gap-1 text-xs text-[#9eaccf] hover:text-[#ff7a7a]"
            >
              <X size={14} />
              Entfernen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
