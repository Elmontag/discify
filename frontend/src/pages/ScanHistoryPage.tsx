import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Disc3, Save, Trash2, X } from 'lucide-react'
import { api } from '../api/client'
import { useRefresh } from '../context/RefreshContext'
import type { AlternativeHit, ScanHistoryDetail, ScanHistoryItem } from '../api/types'

function parseScanItem(item: ScanHistoryItem): ScanHistoryDetail {
  let analysis: ScanHistoryDetail['analysis'] = []
  let discogsResults: ScanHistoryDetail['discogsResults'] = []
  try { analysis = JSON.parse(item.analysis_json) } catch { /* */ }
  try { discogsResults = JSON.parse(item.discogs_results_json) } catch { /* */ }
  return { ...item, analysis, discogsResults }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

interface EditState {
  scanId: number
  discogsResults: ScanHistoryDetail['discogsResults']
  originalResults: ScanHistoryDetail['discogsResults']
}

export default function ScanHistoryPage() {
  const { historyVersion } = useRefresh()
  const [items, setItems] = useState<ScanHistoryDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const PER_PAGE = 24

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getScanHistory(p)
      setTotal(data.total)
      setPage(p)
      setItems((prev) =>
        p === 1 ? data.items.map(parseScanItem) : [...prev, ...data.items.map(parseScanItem)],
      )
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(1) }, [load, historyVersion])

  async function handleDelete(id: number) {
    if (!window.confirm('Scan-Eintrag wirklich löschen?')) return
    try {
      await api.deleteScanHistoryItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      setTotal((t) => t - 1)
    } catch (e: unknown) {
      alert((e as Error).message)
    }
  }

  function openEdit(item: ScanHistoryDetail) {
    const copy = JSON.parse(JSON.stringify(item.discogsResults))
    setEditState({ scanId: item.id, discogsResults: copy, originalResults: copy })
    setSaveSuccess(false)
  }

  function updateEditField(
    idx: number,
    field: keyof ScanHistoryDetail['discogsResults'][number],
    value: string,
  ) {
    if (!editState) return
    setEditState((prev) => {
      if (!prev) return prev
      const updated = prev.discogsResults.map((r, i) =>
        i === idx ? { ...r, [field]: value } : r,
      )
      return { ...prev, discogsResults: updated }
    })
  }

  function swapAlternative(cdIdx: number, alt: AlternativeHit) {
    if (!editState) return
    setEditState((prev) => {
      if (!prev) return prev
      const updated = prev.discogsResults.map((r, i) =>
        i === cdIdx
          ? {
              ...r,
              artist: alt.artist,
              title: alt.title,
              album: alt.album,
              catno: alt.catno ?? '',
              label: alt.label ?? '',
              cover_url: alt.cover_url ?? '',
              thumb_url: alt.thumb_url ?? '',
              release_id: alt.release_id,
              year: alt.year,
            }
          : r,
      )
      return { ...prev, discogsResults: updated }
    })
  }

  function restoreOriginalResult(cdIdx: number) {
    if (!editState) return
    setEditState((prev) => {
      if (!prev) return prev
      const updated = prev.discogsResults.map((r, i) =>
        i === cdIdx ? prev.originalResults[i] : r,
      )
      return { ...prev, discogsResults: updated }
    })
  }

  async function saveEdit() {
    if (!editState) return
    setSaving(true)
    try {
      const updated = await api.updateScanHistoryItem(editState.scanId, {
        discogs_results_json: JSON.stringify(editState.discogsResults),
      })
      setItems((prev) =>
        prev.map((item) => (item.id === editState.scanId ? parseScanItem(updated) : item)),
      )
      setSaveSuccess(true)
      setTimeout(() => setEditState(null), 800)
    } catch (e: unknown) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-white/8 bg-[#07111f]/95 backdrop-blur-lg px-4 py-3">
        <h1 className="text-lg font-bold text-[#f5f7ff]">Scan-Verlauf</h1>
        <p className="text-xs text-[#9eaccf]">{total} Scans gespeichert</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6">
        {error && (
          <div className="mb-4 rounded-2xl border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 p-4 text-sm text-[#ffb0b0]">
            {error}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Clock size={56} className="mb-4 text-[#9eaccf]" />
            <h2 className="mb-2 text-lg font-bold text-[#f5f7ff]">Noch keine Scans</h2>
            <p className="text-sm text-[#9eaccf]">Starte deinen ersten Scan über den + Button.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => {
            const firstResult = item.discogsResults[0]
            const thumb = firstResult?.cover_url || firstResult?.thumb_url || ''
            const cdCount = item.discogsResults.length
            return (
              <div
                key={item.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/3 transition-all hover:border-white/20"
              >
                {/* Thumbnail */}
                <div className="aspect-square w-full overflow-hidden bg-white/5 relative">
                  {thumb ? (
                    <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#9eaccf]">
                      <Disc3 size={40} strokeWidth={1.2} />
                    </div>
                  )}
                  {cdCount > 1 && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-[#f5f7ff] backdrop-blur-sm">
                      {cdCount} CDs
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="flex flex-col gap-1 p-3">
                  <p className="text-xs text-[#9eaccf]">{formatDate(item.created_at)}</p>
                  {item.discogsResults.slice(0, 2).map((r, i) => (
                    <p key={i} className="truncate text-xs font-semibold text-[#f5f7ff]">
                      {r.artist || r.ai_artist || '—'}
                      {(r.album || r.ai_album) ? ` – ${r.album || r.ai_album}` : ''}
                    </p>
                  ))}
                  {cdCount > 2 && (
                    <p className="text-xs text-[#9eaccf]">+{cdCount - 2} weitere</p>
                  )}
                  {/* Actions */}
                  <div className="flex gap-1.5 pt-1">
                    <button
                      onClick={() => openEdit(item)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/10 py-1.5 text-xs font-semibold text-[#9eaccf] hover:border-[#7c5cff]/40 hover:text-[#a88eff]"
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="flex items-center justify-center rounded-xl border border-white/10 px-2 py-1.5 text-[#9eaccf] hover:border-[#ff7a7a]/40 hover:text-[#ffb0b0]"
                      aria-label="Löschen"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {page < totalPages && (
          <button
            onClick={() => load(page + 1)}
            disabled={loading}
            className="mt-6 w-full rounded-2xl border border-white/10 bg-white/4 py-3 text-sm font-semibold text-[#9eaccf] disabled:opacity-50"
          >
            {loading ? 'Lädt …' : 'Mehr laden'}
          </button>
        )}
      </div>

      {/* Edit modal */}
      {editState && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(7,17,31,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => e.target === e.currentTarget && setEditState(null)}
        >
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-t border-white/8 bg-[#0d1e33] max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <h3 className="text-base font-bold text-[#f5f7ff]">Scan bearbeiten</h3>
              <button onClick={() => setEditState(null)} className="text-[#9eaccf] hover:text-[#f5f7ff]">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {editState.discogsResults.map((r, i) => (
                <div key={i} className="space-y-2 rounded-2xl border border-white/8 bg-white/3 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#9eaccf]">CD {i + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-[#9eaccf]">Interpret</label>
                      <input
                        className="mt-1 w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                        value={r.artist}
                        onChange={(e) => updateEditField(i, 'artist', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9eaccf]">Album</label>
                      <input
                        className="mt-1 w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                        value={r.album ?? r.title}
                        onChange={(e) => updateEditField(i, 'album', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9eaccf]">Katalognr.</label>
                      <input
                        className="mt-1 w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                        value={r.catno}
                        onChange={(e) => updateEditField(i, 'catno', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9eaccf]">Label</label>
                      <input
                        className="mt-1 w-full rounded-xl bg-white/6 px-3 py-2 text-sm text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
                        value={r.label}
                        onChange={(e) => updateEditField(i, 'label', e.target.value)}
                      />
                    </div>
                  </div>
                  {r.alternatives && r.alternatives.length > 0 && (
                    <div className="pt-1">
                      <p className="text-xs text-[#9eaccf] uppercase tracking-wide mb-1.5">Alternativen</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => restoreOriginalResult(i)}
                          className="rounded-lg border border-[#7c5cff]/30 bg-[#7c5cff]/10 px-2 py-1 text-xs text-[#a88eff] hover:border-[#7c5cff]/60 hover:bg-[#7c5cff]/20 transition-colors"
                          title="Zum ursprünglichen Treffer zurück"
                        >
                          ↩ Original
                        </button>
                        {r.alternatives.slice(0, 6).map((alt, j) => (
                          <button
                            key={j}
                            onClick={() => swapAlternative(i, alt)}
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
                </div>
              ))}
            </div>

            <div className="border-t border-white/8 p-5">
              {saveSuccess && (
                <div className="mb-3 flex items-center gap-2 text-sm text-[#86f0c9]">
                  <CheckCircle2 size={16} /> Gespeichert
                </div>
              )}
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Save size={16} />
                )}
                {saving ? 'Speichert…' : 'Änderungen speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
