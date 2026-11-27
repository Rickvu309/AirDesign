import * as doom from "@airdesign/doom"
import type { DoomDeck } from "@airdesign/live"
import { DoomSlide, Filmstrip } from "@airdesign/render"
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react"
import { AirdesignMark } from "@/components/ui/airdesign-mark"
import { Button, buttonVariants } from "@/components/ui/button"
import { hairlineShadow, surfaceShadow } from "@/components/ui/shadows"
import { deckViewCopy } from "@/copy/deck-view-copy"
import { productCopy } from "@/copy/product-copy"
import { slideListCopy } from "@/copy/slide-list-copy"
import { useAssetUrls } from "@/editing/use-asset-urls"
import { useSlideScreenshots } from "@/editing/use-slide-screenshots"
import { cn } from "@/lib/class-names"
import { slideNumber } from "@/lib/slide-numbering"
import { useViewDeck } from "./use-view-deck"

const thumbWidth = 64

function paddingOf(room: Room): number {
  return room.width < 640 ? 16 : 24
}

type Room = { readonly width: number; readonly height: number }

function useRoom(): [(element: HTMLElement | null) => void, Room | null] {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  useLayoutEffect(() => {
    if (element === null) return
    const measure = () => setRoom({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [setElement, room]
}

function fitWidth(room: Room, size: { readonly w: number; readonly h: number }): number {
  const padding = paddingOf(room)
  const width = Math.max(0, room.width - padding * 2)
  const height = Math.max(0, room.height - padding * 2)
  return Math.floor(Math.min(width, (height * size.w) / size.h))
}

function stepOf(key: string, at: number, count: number): number | null {
  if (key === "ArrowLeft") return Math.max(0, at - 1)
  if (key === "ArrowRight") return Math.min(count - 1, at + 1)
  if (key === "Home") return 0
  if (key === "End") return count - 1
  return null
}

function OpenLink({ href }: { readonly href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={buttonVariants({ size: "dense" })}>
      {deckViewCopy.openInAirDesign}
    </a>
  )
}

function ShownDeck({ id, client }: { readonly id: string; readonly client: DoomDeck }) {
  const view = useSyncExternalStore(client.subscribe, client.view)
  const assets = useAssetUrls(id, view)
  useSlideScreenshots(client, assets.assetUrl)
  const slides = doom.slidesOf(view).map((slide) => slide.id)
  const [chosen, setChosen] = useState<doom.NodeId | undefined>(undefined)
  const at = Math.max(0, chosen === undefined ? 0 : slides.indexOf(chosen))
  const slide = slides[at]
  const { size } = doom.deckOf(view)
  const [roomRef, room] = useRoom()
  const strip = useRef<HTMLElement>(null)
  const stepped = useRef(false)

  useLayoutEffect(() => {
    const current = strip.current?.querySelector<HTMLElement>('[aria-current="true"]')
    current?.scrollIntoView({ block: "nearest", inline: "nearest" })
    if (stepped.current) current?.focus()
    stepped.current = false
  }, [at])

  const step = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return
    const next = stepOf(event.key, at, slides.length)
    if (next === null) return
    event.preventDefault()
    stepped.current = true
    setChosen(slides[next])
  }

  const width = room === null ? 0 : fitWidth(room, size)
  const thumbHeight = Math.round((thumbWidth * size.h) / size.w)
  return (
    <div className="flex h-dvh flex-col bg-canvas text-foreground" data-deck-view-ready={id}>
      <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line bg-white pr-2 pl-4">
        <AirdesignMark size={20} />
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{doom.deckName(view)}</h1>
        <OpenLink href={`/s/${id}`} />
      </header>
      <main ref={roomRef} className="relative flex min-h-0 flex-1 items-center justify-center">
        {slide !== undefined && width > 0 && (
          <div
            className={cn("overflow-hidden rounded-xs bg-white", surfaceShadow)}
            style={{ width, height: Math.round((width * size.h) / size.w) }}
            data-view-slide={slide}
          >
            <DoomSlide doom={view} slide={slide} width={width} assetUrl={assets.assetUrl} />
          </div>
        )}
      </main>
      {slides.length > 1 && (
        <nav
          ref={strip}
          aria-label={slideListCopy.listName}
          className="flex shrink-0 scroll-px-3 gap-1 overflow-x-auto border-t border-line bg-white px-3 py-1.5 max-[480px]:hidden"
          data-slide-list
          onKeyDown={step}
        >
          {slides.map((each, index) => (
            <Button
              key={each}
              variant="slide-thumb"
              size="thumb"
              aria-current={index === at ? "true" : undefined}
              tabIndex={index === at ? 0 : -1}
              aria-label={slideListCopy.slideName(slideNumber(index), slides.length)}
              onClick={() => setChosen(each)}
              data-view-thumb={each}
            >
              <Filmstrip
                className={cn(
                  "block overflow-hidden rounded-xs bg-white",
                  index === at ? "ring-2 ring-index" : hairlineShadow,
                )}
                width={thumbWidth}
                height={thumbHeight}
                paint={() => <DoomSlide doom={view} slide={each} width={thumbWidth} assetUrl={assets.assetUrl} />}
              />
            </Button>
          ))}
        </nav>
      )}
    </div>
  )
}

function Missing() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-canvas px-6 text-center" data-deck-view-missing>
      <h1 className="text-[length:var(--type-title)] leading-8 font-medium tracking-page-title">
        {productCopy.deckNotFoundTitle}
      </h1>
      <p className="mt-2 max-w-sm text-[length:var(--type-body)] leading-[var(--leading-body)] text-muted-foreground">
        {productCopy.deckNotFoundBody}
      </p>
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ size: "lg", className: "mt-6 h-9 px-3.5" })}
      >
        {productCopy.goToDecks}
      </a>
    </div>
  )
}

export function DeckView({ id }: { readonly id: string }) {
  const opening = useViewDeck(id)
  if (opening.status === "missing") return <Missing />
  if (opening.status === "loading")
    return (
      <div className="h-dvh bg-canvas" aria-busy="true">
        <span className="sr-only">{deckViewCopy.opening}</span>
      </div>
    )
  return <ShownDeck id={id} client={opening.deck} />
}
