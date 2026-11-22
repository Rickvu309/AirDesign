import { Filmstrip } from "@airdesign/render"
import { useEffect, useState } from "react"
import { DeckInitial } from "@/decks/deck-card"
import { fittedWidth, usePreviewBox, type Size } from "@/decks/deck-preview"
import { doomThumbnail, thumbnailWidth } from "@/decks/doom-thumbnail"
import { hairlineShadow } from "@/editor/editor-chrome"
import { cn } from "@/lib/class-names"

const slideRatio = 1080 / 1920

function ThumbnailPaint({ deck, rev, name, box }: { deck: string; rev: number; name: string; box: Size }) {
  const [markup, setMarkup] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    void doomThumbnail(deck, rev).then((painted) => {
      if (live) setMarkup(painted)
    })
    return () => {
      live = false
    }
  }, [deck, rev])
  if (markup === undefined) return null
  if (markup === null) return <DeckInitial name={name} />
  const width = fittedWidth(box, { width: 1920, height: 1080 })
  return (
    <div
      data-doom-thumbnail=""
      className={cn("shrink-0 overflow-hidden rounded-[2px]", hairlineShadow)}
      style={{ width, height: width * slideRatio }}
    >
      <div
        style={{ width: thumbnailWidth, transform: `scale(${String(width / thumbnailWidth)})`, transformOrigin: "0 0" }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>
  )
}

export function DoomPreview({ deck, rev, name }: { deck: string; rev: number; name: string }) {
  const { frame, box } = usePreviewBox()
  return (
    <div ref={frame} data-deck-preview className="size-full">
      {box !== null && box.width > 0 && (
        <Filmstrip
          width={box.width}
          height={box.height}
          className="flex items-center justify-center"
          paint={() => <ThumbnailPaint deck={deck} rev={rev} name={name} box={box} />}
        />
      )}
    </div>
  )
}
