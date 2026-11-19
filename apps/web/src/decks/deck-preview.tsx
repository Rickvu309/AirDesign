import { Filmstrip, SlideCanvas } from "@airdesign/render"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { DeckInitial } from "@/decks/deck-card"
import type { FirstSlide } from "@/decks/first-slide"
import { hairlineShadow } from "@/editor/editor-chrome"
import { cn } from "@/lib/class-names"

type Size = { readonly width: number; readonly height: number }

const inset = 16

function fittedWidth(box: Size, slide: Size): number {
  if (slide.width <= 0 || slide.height <= 0) return 0
  const room = { width: box.width - inset * 2, height: box.height - inset * 2 }
  return Math.max(0, Math.floor(Math.min(room.width, (room.height * slide.width) / slide.height)))
}

function FirstSlidePaint({ deck, name, box }: { deck: string; name: string; box: Size }) {
  const [first, setFirst] = useState<FirstSlide | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    let held: FirstSlide | null = null
    void import("@/decks/first-slide")
      .then(({ deviceFirstSlide }) => deviceFirstSlide(deck))
      .catch(() => null)
      .then((painted) => {
        if (!live) {
          painted?.release()
          return
        }
        held = painted
        setFirst(painted)
      })
    return () => {
      live = false
      held?.release()
    }
  }, [deck])
  if (first === undefined) return null
  if (first === null) return <DeckInitial name={name} />
  return (
    <SlideCanvas
      quiet
      slide={first.slide}
      store={first.store}
      width={fittedWidth(box, first.slide)}
      className={cn("shrink-0 overflow-hidden rounded-[2px]", hairlineShadow)}
    />
  )
}

export function DeckPreview({ deck, name, edited }: { deck: string; name: string; edited: string }) {
  const frame = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<Size | null>(null)
  useLayoutEffect(() => {
    const node = frame.current
    if (node === null) return
    const measure = () => {
      const width = Math.round(node.clientWidth)
      const height = Math.round(node.clientHeight)
      setBox((shown) => (shown?.width === width && shown.height === height ? shown : { width, height }))
    }
    measure()
    if (typeof ResizeObserver !== "function") return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={frame} data-deck-preview className="size-full">
      {box !== null && box.width > 0 && (
        <Filmstrip
          width={box.width}
          height={box.height}
          className="flex items-center justify-center"
          paint={() => <FirstSlidePaint key={edited} deck={deck} name={name} box={box} />}
        />
      )}
    </div>
  )
}
