import type { Release } from '../api/types'
import { Disc3 } from 'lucide-react'

interface Props {
  release: Release
}

export default function AlbumCard({ release }: Props) {
  const thumb = release.thumb_url || release.cover_url
  const discogsUrl = `https://www.discogs.com/release/${release.release_id}`

  return (
    <a
      href={discogsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/3 transition-all hover:border-white/20 hover:bg-white/6 active:scale-95"
    >
      <div className="aspect-square w-full overflow-hidden bg-white/5">
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
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-bold text-[#f5f7ff]">{release.title}</p>
        <p className="truncate text-xs text-[#9eaccf]">{release.artist}</p>
        {release.year && (
          <p className="mt-1 text-xs text-[#9eaccf]/70">{release.year}</p>
        )}
      </div>
    </a>
  )
}
