import { useEffect, useRef, useState } from 'react'
import { Camera, Upload, X, Zap, CheckCircle2, AlertCircle } from 'lucide-react'
import ScanResultItem from '../components/ScanResultItem'
import { api } from '../api/client'
import type { ScanResult } from '../api/types'

interface Props {
  onClose: () => void
}

type Step = 'capture' | 'preview' | 'scanning' | 'results'

export default function ScanSheet({ onClose }: Props) {
  const [step, setStep] = useState<Step>('capture')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [results, setResults] = useState<ScanResult[]>([])
  const [collectionIds] = useState<Set<number>>(new Set())
  const [scanError, setScanError] = useState('')
  const [addingAll, setAddingAll] = useState(false)
  const [addResults, setAddResults] = useState<Record<number, 'ok' | 'err'>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFile(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setStep('preview')
  }

  async function startScan() {
    if (!imageFile) return
    setStep('scanning')
    setScanError('')
    try {
      const data = await api.scanImage(imageFile)
      setResults(data.albums)
      setStep('results')
    } catch (e: unknown) {
      setScanError((e as Error).message)
      setStep('preview')
    }
  }

  async function addAllSelected() {
    const toAdd = results.filter((r) => r.include && r.found && r.status !== 'in_collection')
    if (!toAdd.length) return
    setAddingAll(true)
    const newResults: Record<number, 'ok' | 'err'> = {}
    for (const item of toAdd) {
      if (!item.release_id) continue
      try {
        await api.discogsAdd(item.release_id)
        newResults[item.release_id] = 'ok'
      } catch {
        newResults[item.release_id] = 'err'
      }
    }
    setAddResults(newResults)
    setAddingAll(false)
    // Mark added as in_collection
    setResults((prev) =>
      prev.map((r) =>
        r.release_id && newResults[r.release_id] === 'ok'
          ? { ...r, status: 'in_collection', include: false }
          : r,
      ),
    )
  }

  const toAddCount = results.filter((r) => r.include && r.found && r.status !== 'in_collection').length

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(7,17,31,0.96)', backdropFilter: 'blur(8px)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <h2 className="text-base font-bold text-[#f5f7ff]">
          {step === 'capture' && 'Foto aufnehmen'}
          {step === 'preview' && 'Vorschau'}
          {step === 'scanning' && 'Analyse läuft…'}
          {step === 'results' && `${results.length} CDs erkannt`}
        </h2>
        <button onClick={onClose} className="text-[#9eaccf] hover:text-[#f5f7ff]">
          <X size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* STEP: capture */}
        {step === 'capture' && (
          <div className="space-y-3">
            <p className="text-sm text-[#9eaccf]">
              Fotografiere dein CD-Regal von vorne. Je klarer die Rücken zu sehen sind, desto besser funktioniert die KI-Erkennung.
            </p>
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/4 py-5 text-sm font-semibold text-[#f5f7ff] active:bg-white/8"
            >
              <Camera size={22} className="text-[#00c2ff]" />
              Kamera öffnen
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/4 py-5 text-sm font-semibold text-[#f5f7ff] active:bg-white/8"
            >
              <Upload size={22} className="text-[#7c5cff]" />
              Datei auswählen
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {/* STEP: preview */}
        {(step === 'preview') && previewUrl && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-white/8">
              <img src={previewUrl} alt="Vorschau" className="w-full object-contain max-h-64" />
            </div>
            {scanError && (
              <div className="rounded-2xl border border-[#ff7a7a]/25 bg-[#ff7a7a]/10 p-3 text-sm text-[#ffb0b0]">
                {scanError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setStep('capture')}
                className="flex-1 rounded-2xl border border-white/10 bg-white/4 py-3 text-sm font-semibold text-[#9eaccf]"
              >
                Neu aufnehmen
              </button>
              <button
                onClick={startScan}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
              >
                <Zap size={16} />
                Analyse starten
              </button>
            </div>
          </div>
        )}

        {/* STEP: scanning */}
        {step === 'scanning' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-2 border-[#7c5cff]/30 border-t-[#7c5cff] animate-spin" />
            </div>
            <p className="text-sm font-semibold text-[#f5f7ff]">KI analysiert das Foto…</p>
            <p className="text-xs text-[#9eaccf]">Gleicht gefundene CDs mit Discogs ab</p>
          </div>
        )}

        {/* STEP: results */}
        {step === 'results' && (
          <div className="space-y-3">
            {results.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-[#9eaccf]">Keine CDs erkannt. Versuche ein schärferes Foto.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/8 bg-white/3 p-3 text-center">
                  {[
                    ['Erkannt', results.length],
                    ['Neu', results.filter((r) => r.status === 'new').length],
                    ['In Sammlung', results.filter((r) => r.status === 'in_collection').length],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <p className="text-lg font-bold text-[#f5f7ff]">{val}</p>
                      <p className="text-xs text-[#9eaccf]">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {results.map((item, i) => (
                    <ScanResultItem
                      key={item.idx}
                      item={item}
                      collectionIds={collectionIds}
                      onChange={(updated) =>
                        setResults((prev) => prev.map((r, j) => (j === i ? updated : r)))
                      }
                      onRemove={() => setResults((prev) => prev.filter((_, j) => j !== i))}
                    />
                  ))}
                </div>

                {/* Add results feedback */}
                {Object.keys(addResults).length > 0 && (
                  <div className="space-y-1">
                    {Object.entries(addResults).map(([id, status]) => (
                      <div key={id} className={`flex items-center gap-2 rounded-xl p-2 text-xs ${status === 'ok' ? 'text-[#86f0c9]' : 'text-[#ffb0b0]'}`}>
                        {status === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        Release {id}: {status === 'ok' ? 'Hinzugefügt' : 'Fehler'}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {step === 'results' && toAddCount > 0 && (
        <div className="border-t border-white/8 p-4 pb-6">
          <button
            onClick={addAllSelected}
            disabled={addingAll}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #7c5cff, #00c2ff)' }}
          >
            {addingAll ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Wird hinzugefügt…
              </>
            ) : (
              <>
                <CheckCircle2 size={17} />
                {toAddCount} zur Sammlung hinzufügen
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
