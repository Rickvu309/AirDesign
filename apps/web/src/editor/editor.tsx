import * as doom from "@airdesign/doom"
import { useDoomMeasure } from "@airdesign/render"
import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { peekFirstRequest } from "@/lib/first-request"
import { replaceDeckAddress } from "@/editor/slide-address"
import { NotFoundPage } from "@/decks/not-found-page"
import { tabTitleOf } from "@/copy/product-copy"
import { editorCopy } from "@/copy/editor-copy"
import { slideRoom } from "@/editing/canvas-zoom"
import { PanelHead } from "@/editor/editor-chrome"
import { ExportControl } from "@/export/export-control"
import { useExport, usePrintKeyHeld, type ExportStart } from "@/export/export-flow"
import { ResizablePanel } from "@/editor/resizable-panel"
import { useKeptPanel, type ShownPanel } from "@/editor/kept-panel"
import type { ShapesShown } from "@/editor/shape-tool"
import type { AiraStart } from "@/aira/aira-panel"
import { SlideSidebar } from "@/editor/slide-sidebar"
import { useCanvasRoom } from "@/editor/use-canvas-room"
import { ZoomMenu } from "@/editor/zoom-menu"
import { PresentButton } from "@/present/present-button"
import { usePresentKeys } from "@/present/present-keys"
import { PresentLayer } from "@/present/present-layer"
import { morphPairs } from "@/present/morph-pairs"
import { showsOf } from "@/present/slide-arrival"
import { usePresent } from "@/present/use-present"
import { cn } from "@/lib/class-names"
import { percentOf, scaleOf, type Zoom } from "./canvas-view"
import { renameWrites } from "./deck-writes"
import { AgentPanel } from "./agent-panel"
import { DesignPanel } from "./design-panel"
import { DoomCanvas, type CanvasCommands, type CaretWords } from "./canvas"
import { DoomNotes } from "./notes"
import { Thumb } from "./thumb"
import { typingPreview } from "./typing-preview"
import { followLink, linkAt } from "./present-links"
import { noSelection, type Selection } from "./selection"
import { useCurrentSlide } from "./use-current-slide"
import { useAssetUrls } from "./use-asset-urls"
import { useSlideStepKeys } from "./use-slide-step-keys"
import { addAfterKey, useSlideStrip } from "./use-slide-strip"
import type { Tool } from "./use-canvas-pointer"
import { useDoomDeck, useDoomView, type EditorClient, type OpenOptions } from "./use-deck"
import { useSaveShown, type Saving } from "./use-save-shown"
import { useEditingNow } from "./use-editing-now"
import { slideNumber } from "@/lib/slide-numbering"

function deckName(view: doom.Doom): string {
  const deck = [...view.nodes.values()].find((node) => node.type === "deck")
  return deck?.type === "deck" ? (deck.name ?? "") : ""
}

export type EditorStart = {
  readonly panel?: ShownPanel
  readonly tool?: Tool
  readonly editing?: doom.NodeId
  readonly shapes?: ShapesShown
  readonly aira?: AiraStart
  readonly save?: Saving
  readonly export?: ExportStart
}

function Editing({
  client,
  id,
  start,
  measuring,
}: {
  readonly client: EditorClient
  readonly id: string
  readonly start: EditorStart
  readonly measuring: RefObject<doom.Measure | null>
}) {
  const view = useDoomView(client)
  const saved = useSaveShown(client, start.save)
  const editingRuns = useEditingNow(view, Date.now)
  const slides = doom.slidesOf(view).map((each) => each.id)
  const [slide, showSlide] = useCurrentSlide(slides)
  const measure = useDoomMeasure(view)
  useEffect(() => {
    measuring.current = measure
  })
  const [selection, setSelection] = useState<Selection>(noSelection)
  const [cropping, setCropping] = useState<doom.NodeId | null>(null)
  const [tool, setTool] = useState<Tool>(start.tool ?? "move")
  const [panel, setPanel] = useKeptPanel(id, start.panel)
  const [zoom, setZoom] = useState<Zoom>("fit")
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null)
  const idle: CanvasCommands = { zoomTo: setZoom, zoomSelection: null, linkWords: () => undefined }
  const commands = useRef<CanvasCommands>(idle)
  const [words, setWords] = useState<CaretWords | null>(null)
  const presentButton = useRef<HTMLButtonElement>(null)
  const canvas = useCanvasRoom()
  const { size } = doom.deckOf(view)
  const room = canvas.room ?? slideRoom(800)
  const fit = { w: room.width, h: room.height }
  const scale = scaleOf(zoom, fit, size)
  const percent = percentOf(scale)
  const choose = (next: doom.NodeId) => {
    if (next !== slide) setSelection(noSelection)
    showSlide(next)
  }
  const assets = useAssetUrls(id, view)
  const typing = useMemo(typingPreview, [])
  const strip = useSlideStrip({
    view,
    typing,
    measure,
    client,
    slides,
    current: slide,
    onCurrent: choose,
    assetUrl: assets.assetUrl,
  })
  const present = usePresent({
    count: slides.length,
    current: strip.current,
    shows: () => showsOf(view, slides),
    morphOf: (from, to) => morphPairs(view, slides[from], slides[to]),
    onLand: (at) => {
      const landed = slides[at]
      if (landed !== undefined) choose(landed)
      setTimeout(() => presentButton.current?.focus({ preventScroll: true }))
    },
  })
  usePresentKeys(present.show === null, (from) => present.start(from === "first" ? 0 : strip.current))
  useSlideStepKeys({ slides, current: slide, selecting: selection.ids.length > 0, onCurrent: choose })
  const title = deckName(view)
  const exporting = useExport(
    {
      name: title,
      view,
      slides,
      current: strip.current,
      skipped: strip.skipped ?? [],
      assetUrl: assets.assetUrl,
    },
    start.export,
  )
  usePrintKeyHeld()
  useEffect(() => {
    if (title === "") return
    const before = document.title
    document.title = tabTitleOf(title)
    return () => {
      document.title = before
    }
  }, [title])
  return (
    <div className="window-frame flex" data-editor-frame={id} inert={present.show !== null}>
      <div className="contents" onKeyDownCapture={(event) => addAfterKey(event, strip)}>
        <SlideSidebar
          title={title}
          strip={strip}
          save={saved.save}
          onRename={(name) => client.push(renameWrites(view, name))}
        />
      </div>
      <div ref={canvas.onCanvas} className="relative min-w-0 flex-1" data-editor-canvas>
        {slide === undefined ? null : (
          <DoomCanvas
            deck={id}
            assets={assets}
            client={client}
            view={view}
            measure={measure}
            slide={slide}
            editingRuns={editingRuns}
            slideNumber={slideNumber(strip.current)}
            selection={selection}
            onSelection={setSelection}
            tool={tool}
            onTool={setTool}
            panel={panel}
            onPanel={setPanel}
            zoom={zoom}
            scale={scale}
            room={fit}
            overlay={canvas.overlay}
            onZoom={setZoom}
            onCommands={(next) => {
              commands.current = next ?? idle
            }}
            toolbarHost={toolbarHost}
            notice={
              exporting.failed === "capacity"
                ? "export-capacity"
                : exporting.failed === "fonts"
                  ? "export-fonts"
                  : exporting.failed
                    ? "export-failed"
                    : saved.notice
            }
            onExport={exporting.control.openDialog}
            onTryAgain={(notice) => {
              if (notice === "export-capacity") exporting.control.openDialog()
              if (notice === "export-failed" || notice === "export-fonts") exporting.tryAgain()
            }}
            onTyping={typing.set}
            onWords={setWords}
            cropping={cropping}
            onCropping={setCropping}
            {...(start.editing === undefined ? {} : { editing: start.editing })}
            {...(start.shapes === undefined ? {} : { shapes: start.shapes })}
          />
        )}
        <div
          ref={canvas.onOverlay}
          data-canvas-overlay
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center pb-4"
        >
          {slide === undefined ? null : (
            <>
              <div data-notes-width style={{ width: Math.min(size.w * scale, room.width) }}>
                <DoomNotes client={client} view={view} slide={slide} />
              </div>
              <span className="block h-3" />
            </>
          )}
          <div ref={setToolbarHost} className="flex w-full justify-center px-4" />
        </div>
      </div>
      <ResizablePanel panel={panel}>
        <PanelHead>
          <ZoomMenu
            zoom={zoom === "fit" ? "fit" : percent}
            percent={percent}
            onZoom={(next) => commands.current.zoomTo(next === "fit" ? "fit" : next / 100)}
            {...(selection.ids.length === 0 ? {} : { onSelection: () => commands.current.zoomSelection?.() })}
          />
          <span className="flex items-center gap-1">
            <PresentButton ref={presentButton} onClick={() => present.start(strip.current)} />
            <ExportControl flow={exporting} />
          </span>
        </PanelHead>
        <div className={cn("flex min-h-0 flex-1 flex-col", panel === "agent" ? null : "hidden")}>
          <AgentPanel deck={client} view={view} {...(start.aira === undefined ? {} : { start: start.aira })} />
        </div>
        {panel === "design" && slide !== undefined ? (
          <DesignPanel
            deck={id}
            client={client}
            view={view}
            slide={slide}
            slideNumber={slideNumber(strip.current)}
            selection={selection}
            onSelection={setSelection}
            words={words}
            onCrop={setCropping}
            onLinkWords={(link) => commands.current.linkWords(link)}
          />
        ) : null}
      </ResizablePanel>
      <PresentLayer
        present={present}
        title={title}
        count={slides.length}
        size={{ width: size.w, height: size.h }}
        paint={(index, width) => {
          const shown = slides[index]
          return shown === undefined ? null : (
            <Thumb view={view} slide={shown} width={width} assetUrl={assets.assetUrl} />
          )
        }}
        onFollow={(point) => {
          const link = linkAt(view, point)
          return link !== undefined && followLink(link, slides, present.go)
        }}
        notesOf={(index) => doom.propOf(view.nodes.get(slides[index] ?? ("" as doom.NodeId)), "notes")?.chars ?? ""}
      />
    </div>
  )
}

export function Editor({
  id,
  open = {},
  start = {},
}: {
  readonly id: string | null
  readonly open?: OpenOptions
  readonly start?: EditorStart
}) {
  const [request] = useState(() => (id === null ? peekFirstRequest() : undefined))
  const measuring = useRef<doom.Measure | null>(null)
  const opening = useDoomDeck(id, {
    arrived: (made) => replaceDeckAddress(window.history, window.location, made),
    measure: () => measuring.current,
    ...open,
  })
  if (opening.status === "missing") return <NotFoundPage kind="deck" />
  if (opening.status === "loading")
    return (
      <div className="window-frame" aria-busy="true" aria-label={editorCopy.loading}>
        <div className="h-full bg-canvas" />
      </div>
    )
  const started = request === undefined ? start : { ...start, aira: { ...start.aira, request } }
  return <Editing client={opening.deck} id={opening.id} start={started} measuring={measuring} />
}
