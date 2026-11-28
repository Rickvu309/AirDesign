import * as doom from "@airdesign/doom"
import type { DoomDeck, DoomRemote } from "@airdesign/live"
import { DoomSlide, Filmstrip, SlidePaint, useDoomSlide } from "@airdesign/render"
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react"
import { AirdesignMark } from "@/components/ui/airdesign-mark"
import { Button, buttonVariants } from "@/components/ui/button"
import { EditorIcon } from "@/components/ui/editor-icons"
import { hairlineShadow, surfaceShadow } from "@/components/ui/shadows"
import { Skeleton } from "@/components/ui/skeleton"
import { deckViewCopy } from "@/copy/deck-view-copy"
import { productCopy } from "@/copy/product-copy"
import { slideListCopy } from "@/copy/slide-list-copy"
import { hitChain } from "@/editing/hit-test"
import { geometryOf, type Placed } from "@/editing/slide-geometry"
import { useAssetUrls, type AssetSource } from "@/editing/use-asset-urls"
import { useSlideScreenshots } from "@/editing/use-slide-screenshots"
import { cn } from "@/lib/class-names"
import { composing } from "@/lib/composing"
import { slideNumber } from "@/lib/slide-numbering"
import { appUrl } from "./app-url"
import type { ChatHost, HostContext, Viewed } from "./chat-host"
import { useViewDeck } from "./use-view-deck"
import "./deck-view.css"

const thumbWidth = 64

function paddingOf(room: Room): number {
  return room.width < 640 ? 16 : 24
}

type Room = { readonly width: number; readonly height: number }

function useRoom(): [RefObject<HTMLElement | null>, Room | null] {
  const stage = useRef<HTMLElement>(null)
  const [room, setRoom] = useState<Room | null>(null)
  useLayoutEffect(() => {
    const element = stage.current
    if (element === null) return
    const measure = () => setRoom({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [stage, room]
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

export type Shell = {
  readonly openLink?: (url: string) => void
  readonly fitHeight?: (height: number) => void
  readonly tellModel?: (viewed: Viewed) => void
  readonly closed?: AbortSignal
  readonly displayMode?: HostContext["displayMode"]
  readonly canFullscreen?: boolean
  readonly requestDisplayMode?: ChatHost["requestDisplayMode"]
  readonly safeAreaInsets?: HostContext["safeAreaInsets"]
}

function padding(insets: HostContext["safeAreaInsets"]) {
  if (insets === undefined) return undefined
  const { top, right, bottom, left } = insets
  return { paddingTop: top, paddingRight: right, paddingBottom: bottom, paddingLeft: left }
}

function opener(shell: Shell) {
  const { openLink } = shell
  if (openLink === undefined) return undefined
  return (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    openLink(event.currentTarget.href)
  }
}

function OpenLink({ href, shell }: { readonly href: string; readonly shell: Shell }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={deckViewCopy.openInAirDesign}
      title={deckViewCopy.openInAirDesign}
      className={buttonVariants({
        variant: "ghost",
        size: "dense",
        className: "max-[480px]:size-7 max-[480px]:px-0",
      })}
      onClick={opener(shell)}
    >
      <span className="max-[480px]:hidden">{deckViewCopy.openInAirDesign}</span>
      <EditorIcon name="arrowUpRight" strokeWidth={2} />
    </a>
  )
}

type Picked = { readonly slide: doom.NodeId; readonly layers: readonly doom.NodeId[] }

function Outline({
  placed,
  scale,
  width,
  ...marks
}: {
  readonly placed: Placed
  readonly scale: number
  readonly width: number
  readonly "data-view-hover"?: string
  readonly "data-view-selected"?: string
}) {
  const points = placed.corners.map((corner) => `${String(corner.x * scale)},${String(corner.y * scale)}`).join(" ")
  return <polygon {...marks} points={points} fill="none" stroke="var(--primary-strong)" strokeWidth={width} />
}

function nextPick(picked: readonly doom.NodeId[], layer: doom.NodeId | null, adding: boolean): readonly doom.NodeId[] {
  if (!adding) return layer === null ? [] : [layer]
  if (layer === null) return picked
  return picked.includes(layer) ? picked.filter((each) => each !== layer) : [...picked, layer]
}

function ViewSlide({
  view,
  slide,
  width,
  assetUrl,
  picked,
  onPick,
}: {
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly width: number
  readonly assetUrl: (name: string) => string | undefined
  readonly picked: readonly doom.NodeId[]
  readonly onPick: ((layers: readonly doom.NodeId[]) => void) | undefined
}) {
  const painted = useDoomSlide(view, slide)
  const { size } = doom.deckOf(view)
  const geometry = useMemo(() => geometryOf(painted.nodes ?? []), [painted.nodes])
  const [hovered, setHovered] = useState<doom.NodeId | null>(null)
  const scale = width / size.w
  const layerAt = (event: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const at = { x: (event.clientX - box.left) / scale, y: (event.clientY - box.top) / scale }
    return hitChain(geometry.roots, at, 4.5 / scale, (id) => doom.lockedIn(view, id))?.[0]?.id ?? null
  }
  const chosen = picked.flatMap((id) => geometry.byId.get(id) ?? [])
  const hover = hovered === null || picked.includes(hovered) ? undefined : geometry.byId.get(hovered)
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xs bg-white",
        surfaceShadow,
        onPick !== undefined && "select-none",
      )}
      style={{ width, height: Math.round((width * size.h) / size.w) }}
      data-view-slide={slide}
      data-fonts-pending={painted.ready && painted.fontsReady ? undefined : ""}
      {...(onPick === undefined
        ? {}
        : {
            onClick: (event: MouseEvent<HTMLElement>) => onPick(nextPick(picked, layerAt(event), event.shiftKey)),
            onPointerMove: (event: PointerEvent<HTMLElement>) => setHovered(layerAt(event)),
            onPointerLeave: () => setHovered(null),
          })}
    >
      <SlidePaint
        nodes={painted.nodes ?? []}
        background={painted.background}
        size={size}
        width={width}
        assetUrl={assetUrl}
        iconsReady={painted.ready}
      />
      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true">
        {hover === undefined ? null : <Outline placed={hover} scale={scale} width={1} data-view-hover="" />}
        {chosen.map((placed) => (
          <Outline key={placed.id} placed={placed} scale={scale} width={2} data-view-selected={placed.id} />
        ))}
      </svg>
    </div>
  )
}

function ShownDeck({
  id,
  client,
  slide: named,
  shell,
  source,
}: {
  readonly id: string
  readonly client: DoomDeck
  readonly slide: string | undefined
  readonly shell: Shell
  readonly source: AssetSource | undefined
}) {
  const view = useSyncExternalStore(client.subscribe, client.view)
  const assets = useAssetUrls(id, view, source)
  useSlideScreenshots(client, assets.assetUrl)
  const slides = doom.slidesOf(view).map((slide) => slide.id)
  const [chosen, setChosen] = useState<doom.NodeId | undefined>(undefined)
  const [picked, setPicked] = useState<Picked | null>(null)
  useEffect(() => {
    if (named !== undefined) setChosen(named as doom.NodeId)
  }, [named])
  const at = Math.max(0, chosen === undefined ? 0 : slides.indexOf(chosen))
  const slide = slides[at]
  const { tellModel, fitHeight, requestDisplayMode } = shell
  const fullscreen = shell.displayMode === "fullscreen"
  const insets = fullscreen ? shell.safeAreaInsets : undefined
  const layers =
    picked !== null && picked.slide === slide ? picked.layers.filter((id) => doom.slideOf(view, id) === slide) : []
  const selected = layers.length > 0
  const [firstLayer] = layers
  const layerName =
    firstLayer !== undefined && layers.length === 1 ? doom.propOf(view.nodes.get(firstLayer), "name") : undefined
  const name = doom.deckName(view)
  const [stage, room] = useRoom()
  const strip = useRef<HTMLElement>(null)
  const header = useRef<HTMLElement>(null)
  const selection = useRef<HTMLDivElement>(null)
  const stepped = useRef(false)
  const restoreStage = () => {
    if (selection.current?.contains(document.activeElement)) stage.current?.focus({ preventScroll: true })
  }
  const choose = (index: number) => {
    const next = slides[index]
    if (next === undefined) return
    restoreStage()
    setChosen(next)
    setPicked(null)
    tellModel?.({ deck: id, slide: next, slideNumber: slideNumber(index), selected: [] })
  }
  const pick =
    tellModel === undefined || slide === undefined
      ? undefined
      : (layers: readonly doom.NodeId[]) => {
          setPicked(layers.length === 0 ? null : { slide, layers })
          tellModel({ deck: id, slide, slideNumber: slideNumber(at), selected: layers })
        }
  const { size } = doom.deckOf(view)
  const wide = room?.width
  const many = slides.length > 1

  useLayoutEffect(() => {
    if (fullscreen || fitHeight === undefined || wide === undefined) return
    const padding = paddingOf({ width: wide, height: 0 })
    const slideHeight = Math.round(((wide - padding * 2) * size.h) / size.w)
    fitHeight(
      (header.current?.offsetHeight ?? 0) +
        slideHeight +
        padding * 2 +
        (strip.current?.offsetHeight ?? 0) +
        (selection.current?.offsetHeight ?? 0),
    )
  }, [fitHeight, fullscreen, wide, size.w, size.h, many, selected])

  useLayoutEffect(() => {
    const current = strip.current?.querySelector<HTMLElement>('[aria-current="true"]')
    current?.scrollIntoView({ block: "nearest", inline: "nearest" })
    if (stepped.current) current?.focus()
    stepped.current = false
  }, [at])

  const clear = () => {
    restoreStage()
    pick?.([])
  }
  const step = (event: KeyboardEvent<HTMLDivElement>) => {
    if (composing(event) || event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey)
      return
    if (event.key === "Escape") {
      if (fullscreen) {
        event.preventDefault()
        if (!event.repeat) void requestDisplayMode?.("inline")
      } else if (selected) {
        event.preventDefault()
        clear()
      }
      return
    }
    if (!many) return
    const next = stepOf(event.key, at, slides.length)
    if (next === null) return
    event.preventDefault()
    if (next === at) return
    stepped.current = strip.current?.contains(document.activeElement) ?? false
    choose(next)
  }

  const width = room === null ? 0 : fitWidth(room, size)
  const thumbHeight = Math.round((thumbWidth * size.h) / size.w)
  return (
    <div className="deck-view flex h-dvh flex-col" data-deck-view-ready={id} style={padding(insets)} onKeyDown={step}>
      <header
        ref={header}
        className="deck-view-bar flex h-12 shrink-0 items-center gap-2 border-b px-3 max-[480px]:gap-1 max-[480px]:px-2"
      >
        <AirdesignMark size={20} />
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium" title={name}>
          {name}
        </h1>
        {many && (
          <div role="group" aria-label={slideListCopy.listName} className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon"
              className="max-[480px]:size-7"
              aria-label={deckViewCopy.previousSlide}
              aria-keyshortcuts={deckViewCopy.keys.previous}
              title={deckViewCopy.previousSlide}
              disabled={at === 0}
              focusableWhenDisabled
              onClick={() => choose(at - 1)}
            >
              <EditorIcon name="chevl" strokeWidth={2} />
            </Button>
            <span
              className="min-w-10 text-center text-xs whitespace-nowrap text-(--deck-view-quiet) tabular-nums"
              aria-live="polite"
            >
              <span aria-hidden="true">{deckViewCopy.counter(slideNumber(at), slides.length)}</span>
              <span className="sr-only">{slideListCopy.slideName(slideNumber(at), slides.length)}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="max-[480px]:size-7"
              aria-label={deckViewCopy.nextSlide}
              aria-keyshortcuts={deckViewCopy.keys.next}
              title={deckViewCopy.nextSlide}
              disabled={at === slides.length - 1}
              focusableWhenDisabled
              onClick={() => choose(at + 1)}
            >
              <EditorIcon name="chevr" strokeWidth={2} />
            </Button>
          </div>
        )}
        {shell.canFullscreen && requestDisplayMode !== undefined && (
          <Button
            variant="ghost"
            size="icon"
            className="max-[480px]:size-7"
            aria-label={fullscreen ? deckViewCopy.exitFullscreen : deckViewCopy.fullscreen}
            aria-keyshortcuts={fullscreen ? deckViewCopy.keys.clear : undefined}
            title={fullscreen ? deckViewCopy.exitFullscreen : deckViewCopy.fullscreen}
            onClick={() => void requestDisplayMode(fullscreen ? "inline" : "fullscreen")}
          >
            {fullscreen ? (
              <EditorIcon name="exitFullscreen" strokeWidth={2} />
            ) : (
              <EditorIcon name="fullscreen" strokeWidth={2} />
            )}
          </Button>
        )}
        <OpenLink href={appUrl(`/s/${id}`)} shell={shell} />
      </header>
      <main
        ref={stage}
        tabIndex={0}
        aria-label={deckViewCopy.slide}
        aria-keyshortcuts={many ? deckViewCopy.keys.slide : undefined}
        className="relative flex min-h-0 flex-1 items-center justify-center focus-visible:-outline-offset-2"
        onClick={(event) => {
          if (event.target === event.currentTarget) pick?.([])
        }}
      >
        {slide !== undefined && width > 0 && (
          <ViewSlide view={view} slide={slide} width={width} assetUrl={assets.assetUrl} picked={layers} onPick={pick} />
        )}
      </main>
      {selected && (
        <div ref={selection} className="deck-view-bar flex shrink-0 items-center border-t px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-1 rounded-md bg-(--deck-view-room) pl-2" data-view-selection>
            <span role="status" className="min-w-0 truncate text-xs" title={layerName}>
              {layerName ? (
                <>
                  <span className="sr-only">{deckViewCopy.selectedLayer} </span>
                  {layerName}
                </>
              ) : (
                deckViewCopy.layersSelected(layers.length)
              )}
            </span>
            <Button
              variant="ghost"
              size="xs"
              aria-label={deckViewCopy.clearSelection}
              aria-keyshortcuts={fullscreen ? undefined : deckViewCopy.keys.clear}
              onClick={clear}
            >
              {deckViewCopy.clear}
            </Button>
          </div>
        </div>
      )}
      {slides.length > 1 && (
        <nav
          ref={strip}
          aria-label={slideListCopy.listName}
          className="deck-view-bar flex shrink-0 scroll-px-3 gap-1 overflow-x-auto border-t px-3 py-1.5 max-[480px]:hidden"
          data-slide-list
        >
          {slides.map((each, index) => (
            <Button
              key={each}
              variant="slide-thumb"
              size="thumb"
              aria-current={index === at ? "true" : undefined}
              tabIndex={index === at ? 0 : -1}
              aria-label={slideListCopy.slideName(slideNumber(index), slides.length)}
              onClick={() => choose(index)}
              data-view-thumb={each}
            >
              <Filmstrip
                className={cn(
                  "block overflow-hidden rounded-xs bg-white",
                  index === at ? "ring-2 ring-(--deck-view-accent)" : hairlineShadow,
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

function Missing({ shell }: { readonly shell: Shell }) {
  return (
    <div className="deck-view flex h-dvh flex-col items-center justify-center px-6 text-center" data-deck-view-missing>
      <h1 className="text-[length:var(--type-title)] leading-8 font-medium tracking-page-title">
        {productCopy.deckNotFoundTitle}
      </h1>
      <p className="mt-2 max-w-sm text-[length:var(--type-body)] leading-[var(--leading-body)] text-(--deck-view-quiet)">
        {productCopy.deckNotFoundBody}
      </p>
      <a
        href={appUrl("/")}
        target="_blank"
        rel="noreferrer"
        onClick={opener(shell)}
        className={buttonVariants({ size: "lg", className: "mt-6 h-9 px-3.5" })}
      >
        {productCopy.goToDecks}
      </a>
    </div>
  )
}

export function OpeningDeck({ insets }: { readonly insets: HostContext["safeAreaInsets"] }) {
  return (
    <div className="deck-view flex h-dvh flex-col" style={padding(insets)} role="status" aria-busy="true">
      <span className="sr-only">{deckViewCopy.opening}</span>
      <div className="deck-view-bar flex h-12 shrink-0 items-center gap-2 border-b px-3" aria-hidden="true">
        <AirdesignMark size={20} />
        <Skeleton className="h-3 w-24" />
      </div>
      <div
        className="deck-view-stage-placeholder flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4"
        aria-hidden="true"
      >
        <Skeleton className="aspect-video" />
      </div>
    </div>
  )
}

export function DeckView({
  id,
  slide,
  remote,
  shell = {},
  source,
}: {
  readonly id: string
  readonly slide?: string | undefined
  readonly remote: DoomRemote
  readonly shell?: Shell
  readonly source?: AssetSource
}) {
  const opening = useViewDeck(id, remote, shell.closed)
  if (opening.status === "missing") return <Missing shell={shell} />
  if (opening.status === "loading")
    return <OpeningDeck insets={shell.displayMode === "fullscreen" ? shell.safeAreaInsets : undefined} />
  return <ShownDeck id={id} client={opening.deck} slide={slide} shell={shell} source={source} />
}
