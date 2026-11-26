import * as doom from "@airdesign/doom"
import { flushMedia } from "@airdesign/live"
import { useDoomMeasure } from "@airdesign/render"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react"
import { peekFirstRequest } from "@/lib/first-request"
import { replaceDeckAddress } from "@/editor/slide-address"
import { NotFoundPage } from "@/decks/not-found-page"
import { tabTitleOf } from "@/copy/product-copy"
import { editorCopy } from "@/copy/editor-copy"
import { notesWidth, slideRoom, zoomRanges } from "@/editing/canvas-zoom"
import { Island, PanelHead } from "@/editor/editor-chrome"
import { ExportControl } from "@/export/export-control"
import { useExport, usePrintKeyHeld, type ExportStart } from "@/export/export-flow"
import { ResizablePanel } from "@/editor/resizable-panel"
import { useKeptOpen, useKeptPanel, type ShownPanel } from "@/editor/kept-panel"
import { PanelToggle } from "@/editor/panel-toggle"
import type { ShapesShown } from "@/editor/shape-tool"
import type { AiraStart } from "@/aira/aira-panel"
import { SlideSidebar } from "@/editor/slide-sidebar"
import { useCanvasRoom } from "@/editor/use-canvas-room"
import { ZoomMenu } from "@/editor/zoom-menu"
import type { ActionRun } from "./actions-popover"
import { EditorToolbar } from "./editor-toolbar"
import { EditorToaster } from "./editor-toast"
import { ThinNoticeView, type ThinNotice } from "./thin-notice"
import { SlidePictures } from "./use-slide-pictures"
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
import { EditorGrid, type GridCommands, type GridShownZoom, type GridStart } from "./editor-grid"
import { GridLiveCanvas } from "./grid-live-canvas"
import { DoomNotes } from "./notes"
import { Thumb } from "./thumb"
import { typingPreview } from "./typing-preview"
import { followLink, linkAt } from "./present-links"
import { noSelection, type Selection } from "./selection"
import { useCurrentSlide } from "./use-current-slide"
import { useAssetUrls } from "./use-asset-urls"
import { useSlideStepKeys } from "./use-slide-step-keys"
import { useAgentSlide } from "./use-agent-slide"
import { useGridHistoryKeys } from "./use-grid-history-keys"
import { addAfterKey, useSlideStrip } from "./use-slide-strip"
import type { Tool } from "./use-canvas-pointer"
import { useDoomDeck, useDoomView, type EditorClient, type OpenOptions } from "./use-deck"
import { noticeShown, useSaveShown, type Saving } from "./use-save-shown"
import { useEditingNow } from "./use-editing-now"
import { slideNumber } from "@/lib/slide-numbering"

const noActions: ActionRun = {
  chart: null,
  icon: () => undefined,
  picture: () => undefined,
  exportPdf: () => undefined,
}

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
  readonly grid?: GridStart
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
  const [grid, setGrid] = useState(start.grid !== undefined)
  const [leftGrid, setLeftGrid] = useState(false)
  const [gridShown, setGridShown] = useState<GridShownZoom>({ percent: 25, fit: true, selection: false })
  const gridCommands = useRef<GridCommands | null>(null)
  const liveGrid = useRef(false)
  const returnLive = useRef(false)
  const gridBegin = useRef<(() => void) | null>(null)
  const [gridRun, setGridRun] = useState<ActionRun>(noActions)
  const onGridShown = useCallback(
    (next: GridShownZoom) =>
      setGridShown((held) =>
        held.percent === next.percent && held.fit === next.fit && held.selection === next.selection ? held : next,
      ),
    [],
  )
  const onGridCommands = useCallback((next: GridCommands | null) => {
    gridCommands.current = next
  }, [])
  const closeGrid = () => {
    returnLive.current = liveGrid.current
    setGrid(false)
    setLeftGrid(true)
  }
  const onCanvasCommands = useCallback((next: CanvasCommands | null) => {
    commands.current = next ?? idle
  }, [])
  const onGridEditing = useCallback((live: boolean) => {
    liveGrid.current = live
  }, [])
  const onGridBegin = useCallback((begin: (() => void) | null) => {
    gridBegin.current = begin
  }, [])
  const [open, setOpen] = useKeptOpen(grid ? "grid" : "slides")
  const [airaWorking, setAiraWorking] = useState(false)
  const toggleHeld = useRef(false)
  const openPanel = (next: boolean) => {
    toggleHeld.current = document.activeElement?.closest("[data-panel-toggle]") != null
    setOpen(next)
  }
  useLayoutEffect(() => {
    if (!toggleHeld.current) return
    toggleHeld.current = false
    document.querySelector<HTMLElement>("[data-panel-toggle]")?.focus({ preventScroll: true })
  }, [open])
  const [actionsOpen, setActionsOpen] = useState(false)
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
  const [textingOn, setTextingOn] = useState<doom.NodeId>()
  useAgentSlide(view, client.caught, grid || textingOn === slide || cropping !== null, choose)
  const onTyping = useCallback(
    (writes: readonly doom.Write[], on: doom.NodeId | undefined) => {
      typing.set(writes, on)
      setTextingOn(on)
    },
    [typing],
  )
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
  useGridHistoryKeys(grid, client)
  useSlideStepKeys({ slides, current: slide, paused: grid || selection.ids.length > 0, onCurrent: choose })
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
    void flushMedia(id)
    const again = () => void flushMedia(id)
    window.addEventListener("online", again)
    return () => window.removeEventListener("online", again)
  }, [id])
  useEffect(() => {
    if (title === "") return
    const before = document.title
    document.title = tabTitleOf(title)
    return () => {
      document.title = before
    }
  }, [title])
  const notice = noticeShown(saved.notice, exporting.failed)
  const tryAgain = (failed: ThinNotice) => {
    if (failed === "export-capacity") exporting.control.openDialog()
    if (failed === "export-failed" || failed === "export-fonts") exporting.tryAgain()
  }
  const panelHidden = !open
  const pickPanel = (next: ShownPanel) => {
    setPanel(next)
    if (!open) setOpen(true)
  }
  const slidesZoomMenu = (
    <ZoomMenu
      zoom={zoom === "fit" ? "fit" : percent}
      percent={percent}
      onZoom={(next) => commands.current.zoomTo(next === "fit" ? "fit" : next / 100)}
      {...(selection.ids.length === 0 ? {} : { onSelection: () => commands.current.zoomSelection?.() })}
    />
  )
  const headActions = (
    <span className="flex items-center gap-1">
      <PanelToggle open={open} working={airaWorking} onOpen={openPanel} />
      <PresentButton ref={presentButton} onClick={() => present.start(strip.current)} />
      <ExportControl flow={exporting} />
    </span>
  )
  const headRule = <span aria-hidden="true" className="mx-0.5 block h-5 w-px bg-[var(--field-edge)]" />
  const gridZoomMenu = (
    <ZoomMenu
      range={zoomRanges.grid}
      zoom={gridShown.fit ? "fit" : gridShown.percent}
      percent={gridShown.percent}
      onZoom={(next) => gridCommands.current?.zoomTo(next)}
      {...(gridShown.selection ? { onSelection: () => gridCommands.current?.zoomSelection() } : {})}
    />
  )
  const canvasProps = {
    deck: id,
    assets,
    client,
    view,
    measure,
    editingRuns,
    selection,
    onSelection: setSelection,
    tool,
    onTool: setTool,
    panel,
    onPanel: pickPanel,
    onCommands: onCanvasCommands,
    actionsOpen,
    onActionsOpen: setActionsOpen,
    onExport: exporting.control.openDialog,
    onTryAgain: tryAgain,
    onTyping,
    onWords: setWords,
    cropping,
    onCropping: setCropping,
    ...(start.shapes === undefined ? {} : { shapes: start.shapes }),
  }
  return (
    <div className="window-frame flex" data-editor-frame={id} inert={present.show !== null}>
      <EditorToaster />
      {grid ? (
        <>
          <EditorGrid
            deck={id}
            view={view}
            strip={strip}
            onOpen={(index) => {
              strip.onSelect(index)
              closeGrid()
            }}
            hand={tool === "hand"}
            onHand={(hand) => setTool(hand ? "hand" : "move")}
            head={{
              title,
              save: saved.save,
              canAdd: slides.length > 0,
              onAdd: () => strip.onAdd?.(),
              onSlides: closeGrid,
              onRename: (name) => client.push(renameWrites(view, name)),
            }}
            right={
              panelHidden ? (
                <>
                  {gridZoomMenu}
                  {headRule}
                  {headActions}
                </>
              ) : undefined
            }
            bar={
              <EditorToolbar
                tool={tool}
                onTool={(next) => {
                  setTool(next)
                  if (next !== "move" && next !== "hand") gridBegin.current?.()
                }}
                actionsOpen={actionsOpen}
                onActionsOpen={(open) => {
                  setActionsOpen(open)
                  if (open) gridBegin.current?.()
                }}
                run={gridRun}
                panel={panel}
                onPanel={pickPanel}
                {...(start.shapes === undefined ? {} : { shapes: start.shapes })}
              />
            }
            assetUrl={assets.assetUrl}
            onShown={onGridShown}
            onCommands={onGridCommands}
            selection={selection.ids}
            onSelection={setSelection}
            onEditing={onGridEditing}
            onBegin={onGridBegin}
            onRun={setGridRun}
            live={(shown, gridScale, card) => (
              <GridLiveCanvas {...canvasProps} slide={shown} scale={gridScale} card={card} />
            )}
            start={{ ...(start.grid ?? {}), editing: returnLive.current }}
          />
          <SlidePictures client={client} assetUrl={assets.assetUrl} />
          <ThinNoticeView notice={notice} onTryAgain={tryAgain} />
        </>
      ) : (
        <>
          <div className="contents" onKeyDownCapture={(event) => addAfterKey(event, strip)}>
            <SlideSidebar
              title={title}
              strip={strip}
              save={saved.save}
              onRename={(name) => client.push(renameWrites(view, name))}
              arrived={leftGrid}
              arrival={{ view, caught: client.caught, still: `${slide ?? ""} ${String(scale)}` }}
              onGrid={() => {
                if (!returnLive.current) setSelection(noSelection)
                setGrid(true)
              }}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col bg-canvas">
            {panelHidden ? (
              <div className="flex h-14 shrink-0 items-center justify-end pr-2" data-keeps-selection>
                <Island>
                  {slidesZoomMenu}
                  {headRule}
                  {headActions}
                </Island>
              </div>
            ) : null}
            <div ref={canvas.onCanvas} className="relative min-h-0 min-w-0 flex-1" data-editor-canvas>
              {slide === undefined ? null : (
                <DoomCanvas
                  {...canvasProps}
                  slide={slide}
                  slideNumber={slideNumber(strip.current)}
                  zoom={zoom}
                  scale={scale}
                  room={fit}
                  viewport={{ w: canvas.width, h: canvas.height }}
                  overlay={canvas.overlay}
                  onZoom={setZoom}
                  toolbarHost={toolbarHost}
                  notice={notice}
                  {...(start.editing === undefined ? {} : { editing: start.editing })}
                />
              )}
              <div
                ref={canvas.onOverlay}
                data-canvas-overlay
                className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center pb-4"
              >
                {slide === undefined ? null : (
                  <>
                    <div
                      data-notes-width
                      style={{ width: notesWidth(room, { width: size.w * scale, height: size.h * scale }) }}
                    >
                      <DoomNotes client={client} view={view} slide={slide} />
                    </div>
                    <span className="block h-3" />
                  </>
                )}
                <div ref={setToolbarHost} className="flex w-full justify-center px-4" />
              </div>
            </div>
          </div>
        </>
      )}
      <div className={panelHidden ? "hidden" : "contents"}>
        <ResizablePanel panel={panel}>
          <PanelHead>
            {panelHidden ? null : grid ? gridZoomMenu : slidesZoomMenu}
            {panelHidden ? null : headActions}
          </PanelHead>
          <div className={cn("flex min-h-0 flex-1 flex-col", panel === "agent" ? null : "hidden")}>
            <AgentPanel
              deck={client}
              view={view}
              onWorking={setAiraWorking}
              {...(start.aira === undefined ? {} : { start: start.aira })}
            />
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
      </div>
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
