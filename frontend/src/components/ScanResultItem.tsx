import { useState } from 'react'
import { Check, Disc3, RefreshCw, Search, X } from 'lucide-react'
import type { AlternativeHit, ScanResult } from '../api/types'
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

const CONFIDENCE_STYLES = {
  high: 'text-[#86f0c9]',
  medium: 'text-[#ffd166]',
  low: 'text-[#ff9a9a]',
}

const CONFIDENCE_LABELS = {
  high: '● Genaue Übereinstimmung',
  medium: '● Wahrscheinliche Übereinstimmung',
  low: '● Unsichere Übereinstimmung',
}

export default function ScanResultItem({ item, collectionIds, onChange, onRemove }: Props) {
  const [manualQuery, setManualQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [originalItem] = useState<ScanResult>(item)

  const thumb = item.thumb_url || item.cover_url
  const isAlternativeActive = item.release_id !== originalItem.release_id

  function applyAlternative(alt: AlternativeHit) {
    const inCollection = alt.release_id != null && collectionIds.has(alt.release_id)
    onChange({
      ...item,
      found: true,
      title: alt.title,
      album: alt.album,
      artist: alt.artist,
      release_id: alt.release_id,
      master_id: alt.master_id,
      year: alt.year ? String(alt.year) : '',
      cover_url: alt.cover_url,
      thumb_url: alt.thumb_url,
      catno: alt.catno ?? '',
      label: alt.label ?? '',
      in_collection: inCollection,
      status: inCollection ? 'in_collection' : 'new',
      include: !inCollection,
    })
  }

  function restoreOriginal() {
    onChange(originalItem)
  }

  async function refreshSuggestions() {
    setRefreshing(true)
    try {
      const { results } = await api.discogsSearchSuggestions({
        artist: item.ai_artist,
        album: item.ai_album,
        catno: item.catno,
        barcode: item.ai_barcode,
      })
      const alts: AlternativeHit[] = results.slice(1).map((r) => ({
        release_id: r.release_id,
        master_id: r.master_id ?? null,
        title: r.title,
        album: r.album,
        artist: r.artist,
        year: r.year,
        cover_url: r.cover_url,
        thumb_url: r.thumb_url,
        catno: r.catno,
        label: r.label,
      }))
      // Apply the best result if no found match yet, otherwise just update alternatives
      if (!item.found && results.length > 0) {
        const best = results[0]
        const inCollection = best.release_id != null && collectionIds.has(best.release_id)
        onChange({
          ...item,
          found: true,
          title: best.title,
          album: best.album,
          artist: best.artist,
          release_id: best.release_id,
          master_id: best.master_id ?? null,
          year: best.year ? String(best.year) : '',
          cover_url: best.cover_url,
          thumb_url: best.thumb_url,
          catno: best.catno,
          label: best.label,
          status: inCollection ? 'in_collection' : 'new',
          include: !inCollection,
          alternatives: alts,
        })
      } else {
        onChange({ ...item, alternatives: alts })
      }
    } catch {
      // silent – existing result stays
    } finally {
      setRefreshing(false)
    }
  }

  async function runManualSearch() {
    setSearching(true)
    setSearchError('')
    try {
      const query = manualQuery || `${item.ai_artist} ${item.ai_album}`.trim()
      const hit = await api.discogsManualSearch(query)
      const inCollection = collectionIds.has(hit.release_id)
      onChange({
        ...item,
        found: true,
        title: hit.title,
        artist: hit.artist,
        release_id: hit.release_id,
        master_id: hit.master_id,
        year: hit.year ? String(hit.year) : '',
        cover_url: hit.cover_url,
        thumb_url: hit.thumb_url,
        catno: hit.catno ?? '',
        label: hit.label ?? '',
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
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/3">
      {/* Cover */}
      <div className="aspect-square w-full overflow-hidden bg-white/5 relative">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#9eaccf]">
            <Disc3 size={36} strokeWidth={1.2} />
          </div>
        )}
        <span
          className={`absolute top-2 left-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold backdrop-blur-sm ${STATUS_STYLES[item.status]}`}
        >
          {STATUS_LABELS[item.status]}
        </span>
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-[#9eaccf] hover:text-[#ff7a7a] backdrop-blur-sm"
          aria-label="Entfernen"
        >
          <X size={14} />
        </button>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-2 p-3">
        <div>
          <label className="text-xs text-[#9eaccf] uppercase tracking-wide">Artist</label>
          <input
            className="mt-1 w-full rounded-xl bg-white/6 px-2 py-1.5 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
            value={item.ai_artist}
            onChange={(e) => onChange({ ...item, ai_artist: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-[#9eaccf] uppercase tracking-wide">Album</label>
          <input
            className="mt-1 w-full rounded-xl bg-white/6 px-2 py-1.5 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
            value={item.ai_album}
            onChange={(e) => onChange({ ...item, ai_album: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-[#9eaccf] uppercase tracking-wide">Katalognr.</label>
          <input
            className="mt-1 w-full rounded-xl bg-white/6 px-2 py-1.5 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
            value={item.catno}
            onChange={(e) => onChange({ ...item, catno: e.target.value })}
          />
        </div>

        {item.found && (item.label || item.year) && (
          <p className="text-xs text-[#9eaccf]">
            {[item.label, item.year].filter(Boolean).join(' · ')}
          </p>
        )}

        {item.confidence && item.found && (
          <p className={`text-xs ${CONFIDENCE_STYLES[item.confidence]}`}>
            {CONFIDENCE_LABELS[item.confidence]}
          </p>
        )}

        {(item.alternatives && item.alternatives.length > 0 || isAlternativeActive) && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-[#9eaccf] uppercase tracking-wide">Alternativen</p>
              <button
                onClick={refreshSuggestions}
                disabled={refreshing}
                title="Vorschläge neu laden"
                className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs text-[#9eaccf] hover:text-[#a88eff] transition-colors disabled:opacity-40"
              >
                <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? '…' : 'Aktualisieren'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {isAlternativeActive && (
                <button
                  onClick={restoreOriginal}
                  className="rounded-lg border border-[#7c5cff]/30 bg-[#7c5cff]/10 px-2 py-1 text-left text-xs text-[#a88eff] hover:border-[#7c5cff]/60 hover:bg-[#7c5cff]/20 transition-colors"
                  title="Zum ursprünglichen Treffer zurück"
                >
                  ↩ Original
                </button>
              )}
              {item.alternatives && item.alternatives.slice(0, 6).map((alt, i) => (
                <button
                  key={i}
                  onClick={() => applyAlternative(alt)}
                  className="rounded-lg border border-white/10 bg-white/4 px-2 py-1 text-left text-xs text-[#9eaccf] hover:border-[#7c5cff]/40 hover:bg-[#7c5cff]/10 hover:text-[#a88eff] transition-colors"
                  title={alt.catno ? `Katalognr: ${alt.catno}` : ''}
                >
                  <span className="font-medium">{alt.artist}</span>
                  {alt.album && <span className="opacity-80"> – {alt.album}</span>}
                  {alt.year && <span className="ml-1 opacity-50">· {alt.year}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Refresh button when no alternatives shown yet */}
        {item.found && (!item.alternatives || item.alternatives.length === 0) && !isAlternativeActive && (
          <button
            onClick={refreshSuggestions}
            disabled={refreshing}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[#9eaccf] hover:text-[#a88eff] transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Suche Alternativen…' : 'Alternativen suchen'}
          </button>
        )}

        {!item.found && (
          <div className="space-y-1.5">
            <p className="text-xs text-[#ffd166]">Kein Treffer – manuelle Suche:</p>
            <div className="flex gap-1.5">
              <input
                className="flex-1 rounded-xl bg-white/6 px-2 py-1.5 text-xs text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                placeholder={`${item.ai_artist} ${item.ai_album}`.trim()}
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runManualSearch()}
              />
              <button
                onClick={runManualSearch}
                disabled={searching}
                className="flex items-center gap-1 rounded-xl bg-[#7c5cff]/20 px-2 py-1.5 text-xs font-semibold text-[#a88eff] disabled:opacity-50"
              >
                <Search size={12} />
                {searching ? '…' : 'Suchen'}
              </button>
            </div>
            {searchError && <p className="text-xs text-[#ff7a7a]">{searchError}</p>}
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
          <div
            onClick={() =>
              item.status !== 'in_collection' && onChange({ ...item, include: !item.include })
            }
            className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
              item.include ? 'border-[#7c5cff] bg-[#7c5cff]' : 'border-white/20 bg-white/5'
            } ${item.status === 'in_collection' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {item.include && <Check size={10} className="text-white" />}
          </div>
          <span className="text-xs text-[#f5f7ff]">Zur Sammlung</span>
        </label>
      </div>
    </div>
  )
}
