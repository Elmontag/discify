import { useState } from 'react'
import { Disc3, Pencil, X, Save, Trash2 } from 'lucide-react'
import type { Release } from '../api/types'
import { api } from '../api/client'

interface Props {
  release: Release
  onUpdate?: (updated: Partial<Release>) => void
  onDelete?: () => void
}

export default function AlbumCard({ release, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(release.title)
  const [artist, setArtist] = useState(release.artist)
  const [catno, setCatno] = useState(release.catno ?? '')
  const [year, setYear] = useState(release.year ? String(release.year) : '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const thumb = release.thumb_url || release.cover_url
  const discogsUrl = `https://www.discogs.com/release/${release.release_id}`

  async function saveEdit(e: React.MouseEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.discogsPatchCollection(release.release_id, {
        title,
        artist,
        catno,
        year: year ? Number(year) : null,
      })
      onUpdate?.({ title, artist, catno, year: year ? Number(year) : null })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit(e: React.MouseEvent) {
    e.preventDefault()
    setTitle(release.title)
    setArtist(release.artist)
    setCatno(release.catno ?? '')
    setYear(release.year ? String(release.year) : '')
    setEditing(false)
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirmDelete) { setConfirmDelete(true); return }
    if (!release.instance_id) return
    setDeleting(true)
    try {
      await api.discogsRemove(release.instance_id, release.release_id)
      onDelete?.()
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-[#7c5cff]/40 bg-white/5">
        <div className="aspect-square w-full overflow-hidden bg-white/5">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover opacity-60" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#9eaccf]">
              <Disc3 size={40} strokeWidth={1.2} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          <input
            className="w-full rounded-lg bg-white/8 px-2 py-1 text-xs text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Albumtitel"
          />
          <input
            className="w-full rounded-lg bg-white/8 px-2 py-1 text-xs text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Interpret"
          />
          <input
            className="w-full rounded-lg bg-white/8 px-2 py-1 text-xs text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
            value={catno}
            onChange={(e) => setCatno(e.target.value)}
            placeholder="Katalognr."
          />
          <input
            className="w-full rounded-lg bg-white/8 px-2 py-1 text-xs text-[#f5f7ff] outline-none focus:ring-1 focus:ring-[#7c5cff]"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Jahr"
            type="number"
          />
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#7c5cff] py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              <Save size={11} /> {saving ? 'Speichern…' : 'Speichern'}
            </button>
            <button
              onClick={cancelEdit}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/10 py-1.5 text-xs text-[#9eaccf]"
            >
              <X size={11} /> Abbrechen
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/3 transition-all hover:border-white/20 hover:bg-white/6">
      <a
        href={discogsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="aspect-square w-full overflow-hidden bg-white/5 block"
      >
        {thumb ? (
          <img
            src={thumb}
            alt={`${release.artist} – ${release.title}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#9eaccf]">
            <Disc3 size={40} strokeWidth={1.2} />
          </div>
        )}
      </a>
      <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
        {onUpdate && (
          <button
            onClick={(e) => { e.preventDefault(); setEditing(true) }}
            className="flex items-center justify-center rounded-full bg-black/60 p-1.5 text-[#9eaccf] hover:text-[#7c5cff] backdrop-blur-sm"
            aria-label="Bearbeiten"
          >
            <Pencil size={13} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex items-center justify-center rounded-full bg-black/60 p-1.5 backdrop-blur-sm disabled:opacity-50 ${confirmDelete ? 'text-[#ff7a7a]' : 'text-[#9eaccf] hover:text-[#ff7a7a]'}`}
            aria-label={confirmDelete ? 'Wirklich löschen?' : 'Entfernen'}
            title={confirmDelete ? 'Nochmal klicken zum Bestätigen' : 'Aus Sammlung entfernen'}
            onMouseLeave={() => setConfirmDelete(false)}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-bold text-[#f5f7ff]">{release.title}</p>
        <p className="truncate text-xs text-[#9eaccf]">{release.artist}</p>
        {(release.catno || release.year) && (
          <p className="mt-1 truncate text-xs text-[#9eaccf]/70">
            {[release.catno, release.year].filter(Boolean).join(' · ')}
          </p>
        )}
        {release.label && (
          <p className="truncate text-xs text-[#9eaccf]/50">{release.label}</p>
        )}
      </div>
    </div>
  )
}
