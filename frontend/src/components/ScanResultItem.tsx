import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Disc3, RefreshCw, RotateCcw, Search, X } from 'lucide-react'
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
  high: '● Genau',
  medium: '● Wahrscheinlich',
  low: '● Unsicher',
}

function AltRow({ alt, onSelect }: { alt: AlternativeHit; onSelect: () => void }) {
  const thumb = alt.thumb_url || alt.cover_url
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/2 p-2">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/8">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#9eaccf]">
            <Disc3 size={14} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs font-semibold text-[#f5f7ff]">{alt.artist}</p>
        <p className="truncate text-xs text-[#9eaccf]">{alt.album || alt.title}</p>
        <p className="truncate text-[10px] text-[#9eaccf]/60">
          {[alt.year, alt.catno, alt.label].filter(Boolean).join(' · ') || '–'}
        </p>
      </div>
      <button
        onClick={onSelect}
        className="shrink-0 rounded-lg bg-[#7c5cff]/20 px-2 py-1 text-xs font-bold text-[#a88eff] hover:bg-[#7c5cff]/30 transition-colors"
      >
        Wählen
      </button>
    </div>
  )
}

export default function ScanResultItem({ item, collectionIds, onChange, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showAlts, setShowAlts] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [manualQuery, setManualQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [originalItem] = useState<ScanResult>(item)

  const thumb = item.thumb_url || item.cover_url
  const isAlternativeActive = item.release_id !== originalItem.release_id

  const metaChips = [
    item.year && String(item.year),
    item.ai_barcode && `EAN: ${item.ai_barcode}`,
    item.catno && `Kat: ${item.catno}`,
    '–',
  ].filter(Boolean) as string[]

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
    setShowAlts(false)
  }

  function restoreOriginal() {
    onChange(originalItem)
    setShowAlts(false)
  }

  async function fetchAlternatives() {
    setRefreshing(true)
    setSearchError('')
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
      setShowAlts(true)
    } catch {
      // silent
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
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/3">
      <div className="flex items-center gap-3 p-2 md:p-3">
        <div className="h-10 w-10 md:h-14 md:w-14 shrink-0 overflow-hidden rounded-xl bg-white/8">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#9eaccf]">
              <Disc3 size={20} strokeWidth={1.2} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-bold backdrop-blur-sm shrink-0 ${STATUS_STYLES[item.status]}`}>
              {STATUS_LABELS[item.status]}
            </span>
            {item.confidence && item.found && (
              <span className={`text-[10px] font-medium ${CONFIDENCE_STYLES[item.confidence]}`}>
                {CONFIDENCE_LABELS[item.confidence]}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm font-bold text-[#f5f7ff]">
            {item.artist || item.ai_artist}
          </p>
          <p className="truncate text-xs text-[#9eaccf]">
            {item.album || item.ai_album}
          </p>
          <p className="truncate text-[10px] text-[#9eaccf]/60">
            {metaChips.join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => item.status !== 'in_collection' && onChange({ ...item, include: !item.include })}
            disabled={item.status === 'in_collection'}
            className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
              item.include ? 'border-[#7c5cff] bg-[#7c5cff]' : 'border-white/20 bg-white/5'
            } ${item.status === 'in_collection' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title="Zur Sammlung"
          >
            {item.include && <Check size={11} className="text-white" />}
          </button>
          <button
            onClick={onRemove}
            className="rounded-full bg-black/30 p-0.5 text-[#9eaccf] hover:text-[#ff7a7a]"
            aria-label="Entfernen"
          >
            <X size={14} />
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="rounded-lg p-1 text-[#9eaccf] hover:text-[#f5f7ff] transition-colors"
            aria-label={expanded ? 'Einklappen' : 'Ausklappen'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/6 px-3 pb-3 pt-2 space-y-2">
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {([
              ['Interpret', 'ai_artist', item.ai_artist],
              ['Album', 'ai_album', item.ai_album],
              ['Jahr', 'year', item.year],
              ['EAN', 'ai_barcode', item.ai_barcode],
              ['Katalognummer', 'catno', item.catno],
            ] as [string, keyof ScanResult, string][]).map(([label, field, value]) => (
              <div key={field}>
                <label className="text-[10px] text-[#9eaccf] uppercase tracking-wide">{label}</label>
                <input
                  className="mt-0.5 w-full rounded-xl bg-white/6 px-2 py-1.5 text-xs text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                  value={value ?? ''}
                  onChange={(e) => onChange({ ...item, [field]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              onClick={fetchAlternatives}
              disabled={refreshing}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-semibold text-[#9eaccf] hover:text-[#a88eff] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Suche…' : showAlts ? 'Aktualisieren' : 'Alternativen'}
            </button>
            {isAlternativeActive && (
              <button
                onClick={restoreOriginal}
                className="flex items-center gap-1 rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/10 px-3 py-1.5 text-xs font-semibold text-[#a88eff] hover:bg-[#7c5cff]/20 transition-colors"
              >
                <RotateCcw size={12} />
                Zum Original
              </button>
            )}
          </div>
          {showAlts && item.alternatives && item.alternatives.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] uppercase tracking-wide text-[#9eaccf]">
                {item.alternatives.length} Alternativvorschlag{item.alternatives.length !== 1 ? 'e' : ''}
              </p>
              {item.alternatives.slice(0, 8).map((alt, i) => (
                <AltRow key={i} alt={alt} onSelect={() => applyAlternative(alt)} />
              ))}
            </div>
          )}
          {!item.found && (
            <div className="space-y-1.5 pt-1">
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
        </div>
      )}
    </div>
  )
}