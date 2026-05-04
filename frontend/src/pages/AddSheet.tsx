import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Barcode,
  Camera,
  CheckCircle2,
  Disc3,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import ScanResultItem from '../components/ScanResultItem'
import { api } from '../api/client'
import type { DiscogsHit, ScanResult } from '../api/types'

interface Props {
  onClose: () => void
}

type Mode = 'search' | 'barcode' | 'ai-camera' | 'ai-file'
type AiStep = 'capture' | 'preview' | 'scanning' | 'results'

const MODES: { id: Mode; label: string; Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }> }[] = [
  { id: 'search', label: 'Suche', Icon: Search },
  { id: 'barcode', label: 'Barcode', Icon: Barcode },
  { id: 'ai-camera', label: 'KI-Kamera', Icon: Camera },
  { id: 'ai-file', label: 'KI-Datei', Icon: Upload },
]

// ─── Shared result card (for manual / barcode search) ───────────────────────

interface HitCardProps {
  hit: DiscogsHit
  onAdd: (hit: DiscogsHit) => Promise<void>
  added?: boolean
  adding?: boolean
}

function HitCard({ hit, onAdd, added, adding }: HitCardProps) {
  const thumb = hit.thumb_url || hit.cover_url
  return (
    <div className="flex gap-3 items-start rounded-2xl border border-white/8 bg-white/3 p-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/8">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#9eaccf]">
            <Disc3 size={22} strokeWidth={1.2} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-bold text-[#f5f7ff]">{hit.artist}</p>
        <p className="truncate text-sm text-[#9eaccf]">{hit.album || hit.title}</p>
        <p className="mt-0.5 truncate text-xs text-[#9eaccf]/60">
          {[hit.catno, hit.label, hit.year].filter(Boolean).join(' · ')}
        </p>
      </div>
      <button
        onClick={() => onAdd(hit)}
        disabled={added || adding}
        className={`shrink-0 flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
          added
            ? 'bg-[#31d19b]/20 text-[#86f0c9]'
            : 'bg-[#7c5cff]/20 text-[#a88eff] hover:bg-[#7c5cff]/30'
        } disabled:opacity-60`}
      >
        {added ? <CheckCircle2 size={13} /> : adding ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
        {added ? 'Hinzugefügt' : 'Hinzufügen'}
      </button>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AddSheet({ onClose }: Props) {
  const [mode, setMode] = useState<Mode>('search')

  // ── Search mode ──
  const [searchArtist, setSearchArtist] = useState('')
  const [searchAlbum, setSearchAlbum] = useState('')
  const [searchCatno, setSearchCatno] = useState('')
  const [searchEan, setSearchEan] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<DiscogsHit[]>([])
  const [searchError, setSearchError] = useState('')
  const [searchDone, setSearchDone] = useState(false)

  // ── Barcode mode ──
  const [barcodeEan, setBarcodeEan] = useState('')
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [barcodeResults, setBarcodeResults] = useState<DiscogsHit[]>([])
  const [barcodeError, setBarcodeError] = useState('')
  const [barcodeCameraLoading, setBarcodeCameraLoading] = useState(false)
  const barcodeCameraRef = useRef<HTMLInputElement>(null)

  // ── AI scan mode ──
  const [aiStep, setAiStep] = useState<AiStep>('capture')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [aiResults, setAiResults] = useState<ScanResult[]>([])
  const [aiCollectionIds] = useState<Set<number>>(new Set())
  const [aiError, setAiError] = useState('')
  const [addingAll, setAddingAll] = useState(false)
  const [addFeedback, setAddFeedback] = useState<Record<number, 'ok' | 'err'>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // ── Per-hit add state (search / barcode) ──
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set())
  const [addingId, setAddingId] = useState<number | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // ── Reset AI state when mode changes ──
  function switchMode(m: Mode) {
    setMode(m)
    setAiStep('capture')
    setImageFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setAiResults([])
    setAiError('')
    setAddFeedback({})
    setSearchError('')
    setBarcodeError('')
  }

  // ─── Search ─────────────────────────────────────────────────────────────────

  async function runSearch(params?: { artist?: string; album?: string; catno?: string; barcode?: string }) {
    const p = params ?? { artist: searchArtist, album: searchAlbum, catno: searchCatno, barcode: searchEan }
    if (!p.artist && !p.album && !p.catno && !p.barcode) {
      setSearchError('Bitte mindestens ein Feld ausfüllen.')
      return
    }
    setSearchLoading(true)
    setSearchError('')
    setSearchResults([])
    setSearchDone(false)
    try {
      const { results } = await api.discogsSearchSuggestions(p)
      setSearchResults(results)
      setSearchDone(true)
      if (results.length === 0) setSearchError('Keine Treffer gefunden.')
    } catch (e: unknown) {
      setSearchError((e as Error).message)
    } finally {
      setSearchLoading(false)
    }
  }

  async function addHit(hit: DiscogsHit) {
    if (!hit.release_id || addedIds.has(hit.release_id)) return
    setAddingId(hit.release_id)
    try {
      await api.discogsAdd(hit.release_id)
      setAddedIds((prev) => new Set([...prev, hit.release_id]))
    } catch {
      // keep silent – user can retry
    } finally {
      setAddingId(null)
    }
  }

  // ─── Barcode ────────────────────────────────────────────────────────────────

  async function searchByBarcode(ean: string) {
    if (!ean.trim()) return
    setBarcodeLoading(true)
    setBarcodeError('')
    setBarcodeResults([])
    try {
      const { results } = await api.discogsSearchSuggestions({ barcode: ean.trim() })
      setBarcodeResults(results)
      if (results.length === 0) setBarcodeError('Kein Treffer für diesen Barcode.')
    } catch (e: unknown) {
      setBarcodeError((e as Error).message)
    } finally {
      setBarcodeLoading(false)
    }
  }

  async function handleBarcodePhoto(file: File) {
    setBarcodeCameraLoading(true)
    setBarcodeError('')
    try {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      // Use BarcodeDetector if available (Chrome/Edge/Safari 17+)
      if ('BarcodeDetector' in window) {
        type BD = { detect(src: ImageData | HTMLCanvasElement): Promise<Array<{ rawValue: string; format: string }>> }
        const detector = new (window as unknown as { BarcodeDetector: new (opts: object) => BD }).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
        })
        const codes = await detector.detect(imageData)
        if (codes.length > 0) {
          const ean = codes[0].rawValue
          setBarcodeEan(ean)
          await searchByBarcode(ean)
          return
        }
      }
      setBarcodeError('Kein Barcode im Foto erkannt. Bitte EAN manuell eingeben.')
    } catch (e: unknown) {
      setBarcodeError('Foto konnte nicht verarbeitet werden: ' + (e as Error).message)
    } finally {
      setBarcodeCameraLoading(false)
    }
  }

  // ─── AI scan ────────────────────────────────────────────────────────────────

  function handleFile(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setAiStep('preview')
  }

  async function startAiScan() {
    if (!imageFile) return
    setAiStep('scanning')
    setAiError('')
    try {
      const { albums } = await api.scanImage(imageFile)
      setAiResults(albums)
      setAiStep('results')
    } catch (e: unknown) {
      setAiError((e as Error).message)
      setAiStep('preview')
    }
  }

  async function addAllAiSelected() {
    const toAdd = aiResults.filter((r) => r.include && r.found && r.status !== 'in_collection')
    if (!toAdd.length) return
    setAddingAll(true)
    const fb: Record<number, 'ok' | 'err'> = {}
    for (const item of toAdd) {
      if (!item.release_id) continue
      try {
        await api.discogsAdd(item.release_id)
        fb[item.release_id] = 'ok'
      } catch {
        fb[item.release_id] = 'err'
      }
    }
    setAddFeedback(fb)
    setAddingAll(false)
    setAiResults((prev) =>
      prev.map((r) =>
        r.release_id && fb[r.release_id] === 'ok'
          ? { ...r, status: 'in_collection', include: false }
          : r,
      ),
    )
  }

  const aiToAddCount = aiResults.filter((r) => r.include && r.found && r.status !== 'in_collection').length

  // ─── Layout ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet – bottom on mobile, side panel on md+ */}
      <div className="
        fixed z-50
        bottom-0 left-0 right-0 max-h-[90vh] rounded-t-3xl
        md:bottom-0 md:left-auto md:right-auto md:top-0 md:rounded-none md:rounded-l-none
        md:left-16 lg:left-56 md:max-h-none md:h-full md:w-[420px]
        flex flex-col overflow-hidden
        border border-white/10 bg-[#07111f] shadow-2xl
      ">
        {/* Handle bar (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <h2 className="text-base font-bold text-[#f5f7ff]">Hinzufügen</h2>
          <button onClick={onClose} className="text-[#9eaccf] hover:text-[#f5f7ff] transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-white/8">
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => switchMode(id)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                mode === id ? 'border-b-2 border-[#7c5cff] text-[#a88eff]' : 'text-[#9eaccf] hover:text-[#f5f7ff]'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── Suche ── */}
          {mode === 'search' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-[#9eaccf] uppercase tracking-wide">Interpret</label>
                  <input
                    className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                    placeholder="z. B. Pink Floyd"
                    value={searchArtist}
                    onChange={(e) => setSearchArtist(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#9eaccf] uppercase tracking-wide">Album</label>
                  <input
                    className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                    placeholder="z. B. The Wall"
                    value={searchAlbum}
                    onChange={(e) => setSearchAlbum(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#9eaccf] uppercase tracking-wide">Katalognummer</label>
                  <input
                    className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                    placeholder="z. B. CBS 96240"
                    value={searchCatno}
                    onChange={(e) => setSearchCatno(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#9eaccf] uppercase tracking-wide">EAN / Barcode</label>
                  <input
                    className="w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                    placeholder="z. B. 5099748034823"
                    value={searchEan}
                    onChange={(e) => setSearchEan(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  />
                </div>
              </div>

              <button
                onClick={() => runSearch()}
                disabled={searchLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
              >
                {searchLoading
                  ? <RefreshCw size={15} className="animate-spin" />
                  : <Search size={15} />
                }
                {searchLoading ? 'Suche läuft…' : 'Suchen'}
              </button>

              {searchError && (
                <p className="text-xs text-[#ffb0b0]">{searchError}</p>
              )}

              {searchDone && searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((hit) => (
                    <HitCard
                      key={hit.release_id}
                      hit={hit}
                      onAdd={addHit}
                      added={hit.release_id != null && addedIds.has(hit.release_id)}
                      adding={hit.release_id === addingId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Barcode ── */}
          {mode === 'barcode' && (
            <div className="space-y-3">
              <p className="text-sm text-[#9eaccf]">
                Fotografiere den Barcode auf der CD-Hülle oder gib die EAN manuell ein.
              </p>

              <button
                onClick={() => barcodeCameraRef.current?.click()}
                disabled={barcodeCameraLoading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/4 py-4 text-sm font-semibold text-[#f5f7ff] active:bg-white/8 disabled:opacity-50"
              >
                {barcodeCameraLoading
                  ? <RefreshCw size={20} className="animate-spin text-[#7c5cff]" />
                  : <Camera size={20} className="text-[#00c2ff]" />
                }
                {barcodeCameraLoading ? 'Barcode wird erkannt…' : 'Barcode fotografieren'}
              </button>
              <input
                ref={barcodeCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleBarcodePhoto(f)
                  e.target.value = ''
                }}
              />

              {/* EAN viewfinder frame guide */}
              <div className="relative mx-auto flex h-24 w-full max-w-xs items-center justify-center rounded-xl border border-white/6 bg-black/30">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 280 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Top-left corner */}
                  <path d="M12 32 L12 12 L32 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
                  {/* Top-right corner */}
                  <path d="M248 12 L268 12 L268 32" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
                  {/* Bottom-left corner */}
                  <path d="M12 64 L12 84 L32 84" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
                  {/* Bottom-right corner */}
                  <path d="M248 84 L268 84 L268 64" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
                </svg>
                <div className="flex flex-col items-center gap-1 opacity-40">
                  <Barcode size={28} className="text-white" />
                  <span className="text-xs text-white">Barcode im Rahmen platzieren</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#9eaccf]">
                <div className="flex-1 h-px bg-white/10" />
                oder manuell
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                  placeholder="EAN eingeben…"
                  value={barcodeEan}
                  onChange={(e) => setBarcodeEan(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchByBarcode(barcodeEan)}
                />
                <button
                  onClick={() => searchByBarcode(barcodeEan)}
                  disabled={barcodeLoading || !barcodeEan.trim()}
                  className="flex items-center gap-1 rounded-xl bg-[#7c5cff]/20 px-3 py-2 text-xs font-bold text-[#a88eff] disabled:opacity-50"
                >
                  {barcodeLoading
                    ? <RefreshCw size={13} className="animate-spin" />
                    : <Search size={13} />
                  }
                  Suchen
                </button>
              </div>

              {barcodeError && (
                <p className="text-xs text-[#ffb0b0]">{barcodeError}</p>
              )}

              {barcodeResults.length > 0 && (
                <div className="space-y-2">
                  {barcodeResults.map((hit) => (
                    <HitCard
                      key={hit.release_id}
                      hit={hit}
                      onAdd={addHit}
                      added={hit.release_id != null && addedIds.has(hit.release_id)}
                      adding={hit.release_id === addingId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── KI-Kamera / KI-Datei ── */}
          {(mode === 'ai-camera' || mode === 'ai-file') && (
            <div className="space-y-4">
              {aiStep === 'capture' && (
                <div className="space-y-3">
                  <p className="text-sm text-[#9eaccf]">
                    {mode === 'ai-camera'
                      ? 'Fotografiere dein CD-Regal von vorne. Je klarer die Rücken zu sehen sind, desto besser.'
                      : 'Lade ein Foto deines CD-Regals hoch.'}
                  </p>
                  {mode === 'ai-camera' ? (
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/4 py-5 text-sm font-semibold text-[#f5f7ff] active:bg-white/8"
                    >
                      <Camera size={22} className="text-[#00c2ff]" />
                      Kamera öffnen
                    </button>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/4 py-5 text-sm font-semibold text-[#f5f7ff] active:bg-white/8"
                    >
                      <Upload size={22} className="text-[#7c5cff]" />
                      Datei auswählen
                    </button>
                  )}
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                </div>
              )}

              {aiStep === 'preview' && previewUrl && (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-white/8">
                    <img src={previewUrl} alt="Vorschau" className="w-full object-contain max-h-64" />
                  </div>
                  {aiError && (
                    <div className="rounded-2xl border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 p-3 text-sm text-[#ffb0b0]">
                      {aiError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAiStep('capture')}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/4 py-3 text-sm font-semibold text-[#9eaccf]"
                    >
                      Neu aufnehmen
                    </button>
                    <button
                      onClick={startAiScan}
                      className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
                    >
                      <Zap size={16} />
                      Analyse starten
                    </button>
                  </div>
                </div>
              )}

              {aiStep === 'scanning' && (
                <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
                  <div className="h-16 w-16 rounded-full border-2 border-[#7c5cff]/30 border-t-[#7c5cff] animate-spin" />
                  <p className="text-sm font-semibold text-[#f5f7ff]">KI analysiert das Foto…</p>
                  <p className="text-xs text-[#9eaccf]">Gleicht gefundene CDs mit Discogs ab</p>
                </div>
              )}

              {aiStep === 'results' && (
                <div className="space-y-3">
                  {aiResults.length === 0 ? (
                    <p className="py-12 text-center text-sm text-[#9eaccf]">
                      Keine CDs erkannt. Versuche ein schärferes Foto.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/8 bg-white/3 p-3 text-center">
                        {([
                          ['Erkannt', aiResults.length],
                          ['Neu', aiResults.filter((r) => r.status === 'new').length],
                          ['In Sammlung', aiResults.filter((r) => r.status === 'in_collection').length],
                        ] as [string, number][]).map(([label, val]) => (
                          <div key={label}>
                            <p className="text-lg font-bold text-[#f5f7ff]">{val}</p>
                            <p className="text-xs text-[#9eaccf]">{label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {aiResults.map((item, i) => (
                          <ScanResultItem
                            key={item.idx}
                            item={item}
                            collectionIds={aiCollectionIds}
                            onChange={(updated) =>
                              setAiResults((prev) => prev.map((r, j) => (j === i ? updated : r)))
                            }
                            onRemove={() => setAiResults((prev) => prev.filter((_, j) => j !== i))}
                          />
                        ))}
                      </div>

                      {Object.keys(addFeedback).length > 0 && (
                        <div className="space-y-1">
                          {Object.entries(addFeedback).map(([id, status]) => (
                            <div key={id} className={`flex items-center gap-2 rounded-xl p-2 text-xs ${status === 'ok' ? 'text-[#86f0c9]' : 'text-[#ffb0b0]'}`}>
                              {status === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                              Release {id}: {status === 'ok' ? 'Hinzugefügt' : 'Fehler'}
                            </div>
                          ))}
                        </div>
                      )}

                      {aiToAddCount > 0 && (
                        <button
                          onClick={addAllAiSelected}
                          disabled={addingAll}
                          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-60"
                          style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
                        >
                          {addingAll ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                          {addingAll ? 'Wird hinzugefügt…' : `${aiToAddCount} CD${aiToAddCount !== 1 ? 's' : ''} hinzufügen`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
