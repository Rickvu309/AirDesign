import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { ResizablePanel } from "@/editor/resizable-panel"
import { NotesBar } from "@/editor/notes-bar"
import { CanvasStage } from "@/editor/canvas-stage"
import {
  percentWidth,
  slideRoom,
  steppedZoom,
  widthZoom,
  zoomPercent,
  zoomRanges,
  zoomWidth,
  type SlideSize,
  type Zoom,
} from "@/editor/canvas-zoom"
import type { CanvasView } from "@/editor/use-canvas-gestures"
import { PanelHead, ZoomReadout } from "@/editor/editor-chrome"
import { openWith } from "@/editor/slide-opening"
import { EditorGrid } from "@/editor/editor-grid"
import { EditorToolbar, type DesignMode, type EditorPanel, type EditorTool } from "@/editor/editor-toolbar"
import type { ChartKind } from "@airdesign/document"
import { typing, usePointerTool } from "@/editor/pointer-tool"
import { RevenueSlide } from "@/editor/revenue-slide"
import { SlideSidebar, type SidebarRun, type SlideStrip } from "@/editor/slide-sidebar"
import type { UndoButtonsState } from "@/editor/undo-buttons"
import type { FormatShown } from "@/editor/format-buttons"
import type { ToneSource } from "@/editor/tone-link"
import { gestureFor, type Selection, type ShapeDrawing, type TextFormatting } from "@airdesign/render"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import type { SaveStatus } from "@/editor/use-deck-status"
import { ImagesPanel, ShapesPanel, ShapeTray, SlideColumn, TemplatePicker, TextPanel } from "@/editor/tool-panels"
import { useCanvasRoom } from "@/editor/use-canvas-room"
import type { ToolbarTools } from "@/editor/toolbar-tools"
import { useShortcutsKey } from "@/editor/shortcuts-key"
import { useToolKeys } from "@/editor/tool-keys"
import { shapeDrawing, useArmedShapeEnter, type ShapeAdd } from "@/editor/shape-draw-tool"
import type { TextPlace } from "@/element-edit"
import { useChromeKeys } from "@/editor/chrome-keys"
import type { PartsWatch } from "@/editor/use-deck-paint"
import { useKeptView } from "@/editor/kept-view"
import type { GuidesShown } from "@/editor/slide-guides"
import { ShortcutsPanel } from "@/editor/shortcuts-panel"
import { useZoomKeys } from "@/editor/zoom-keys"
import { ZoomMenu } from "@/editor/zoom-menu"
import { ExportControl } from "@/export/export-control"
import type { ExportRequest } from "@/export/export-deck"
import { PresentButton } from "@/present/present-button"
import { usePresentKeys } from "@/present/present-keys"
import { PresentLayer } from "@/present/present-layer"
import type { ShownSlide } from "@/present/slide-shows"
import type { LayerPairs } from "@/present/use-leaving"
import { usePresent } from "@/present/use-present"

export type EditorRail = "slides" | "images" | "shapes" | "text"

const unwatched = () => () => undefined
const unchanged = () => 0

export type EditorDeck = {
  readonly id?: string
  readonly slides: SlideStrip
  readonly size: SlideSize | null
  readonly slide: (
    width: number,
    shown?: GuidesShown,
    onPlaceText?: (place: TextPlace) => void,
    drawShape?: ShapeDrawing,
  ) => ReactNode
  readonly rulers?: () => ReactNode
  readonly displayed?: Pick<PartsWatch, "subscribe" | "version">
  readonly onExport: (request?: ExportRequest) => Promise<void> | void
  readonly undo: UndoButtonsState
  readonly selection?: Selection
  readonly select?: (selection: Selection) => void
  readonly onText?: (place?: TextPlace) => void
  readonly onChart?: (kind: ChartKind) => void
  readonly onSlideNumber?: () => void
  readonly onTrash?: () => void
  readonly onRename?: (name: string) => void
  readonly formatting?: TextFormatting
  readonly tone?: ToneSource
  readonly deckColors?: readonly string[]
  readonly onPicture?: (file: File) => void
  readonly onShape?: ShapeAdd
  readonly onIcon?: (name: string) => void
  readonly save?: SaveStatus | null
  readonly notesOf?: (index: number) => string
  readonly presentPaint?: (index: number, width: number, go: (index: number) => void) => ReactNode
  readonly shows?: () => readonly ShownSlide[]
  readonly morphOf?: (from: number, to: number) => LayerPairs
  readonly layers?: ReactNode
}

export type EditorShellProps = {
  title: string
  slideLabel: string
  notes?: string
  onNotes?: (text: string) => void
  run?: SidebarRun
  panel?: EditorPanel
  onPanel?: (panel: Exclude<EditorPanel, "none">) => void
  designMode?: DesignMode
  side?: ReactNode | ((selectedSlides: number) => ReactNode)
  rail?: EditorRail
  activeTool?: EditorTool
  toolMenu?: boolean
  templatePicker?: boolean
  shapeTray?: boolean
  toast?: ReactNode
  overlay?: ReactNode
  formats?: FormatShown
  layers?: ReactNode
  shortcuts?: boolean
  deck?: EditorDeck
}

export function EditorShell({
  title,
  slideLabel,
  notes,
  onNotes,
  run = "done",
  panel = "none",
  onPanel,
  designMode,
  side,
  rail = "slides",
  activeTool = "move",
  toolMenu = false,
  templatePicker = false,
  shapeTray = false,
  toast,
  overlay,
  formats,
  layers,
  shortcuts: shortcutsShown = false,
  deck,
}: EditorShellProps) {
  const canvas = useCanvasRoom()
  const room = (deck === undefined ? null : canvas.room) ?? slideRoom(rail === "slides" ? 800 : 720)
  const [zoom, setZoom] = useState<Zoom>("fit")
  const [gridOpen, setGridOpen] = useState(false)
  const [gridPanel, setGridPanel] = useState(false)
  const [selectedSlides, setSelectedSlides] = useState(0)
  const [shortcutsOpen, setShortcutsOpen] = useState(shortcutsShown)
  const [bare, setBare] = useState(false)
  const [listHidden, setListHidden] = useState(false)
  const [rulers, setRulers] = useKeptView("rulers")
  const [layoutGuides, setLayoutGuides] = useKeptView("layoutGuides")
  const watched = deck?.displayed
  const version = watched?.version ?? unchanged
  useSyncExternalStore(watched?.subscribe ?? unwatched, version, version)
  const listShown = rail === "slides" && !bare && !listHidden
  const sideContent =
    typeof side === "function" ? side(gridOpen || (listShown && deck !== undefined) ? selectedSlides : 1) : side
  const pointer = usePointerTool(deck !== undefined, !gridOpen)
  const size = deck?.size ?? null
  const width = size === null ? room.width : zoomWidth(zoom, room, size)
  const working = run === "working" || run === "own"
  const strip = deck?.slides
  const presentButton = useRef<HTMLButtonElement>(null)
  const present = usePresent(
    strip === undefined
      ? null
      : {
          count: strip.count,
          current: strip.current,
          ...(deck?.shows === undefined ? {} : { shows: deck.shows }),
          ...(deck?.morphOf === undefined ? {} : { morphOf: deck.morphOf }),
          onLand: (at) => {
            strip.onSelect(at)
            setTimeout(() => presentButton.current?.focus({ preventScroll: true }))
          },
        },
  )
  usePresentKeys(strip !== undefined && !gridOpen && present.show === null, (from) =>
    present.start(from === "first" ? 0 : (strip?.current ?? 0)),
  )
  useToolKeys(deck !== undefined && !gridOpen && present.show === null, {
    onShape: deck?.onShape === undefined ? undefined : pointer.arm,
    onPicture: deck?.onPicture,
  })
  useArmedShapeEnter(pointer, deck?.onShape)
  useChromeKeys(deck !== undefined && !gridOpen && present.show === null, {
    onHideAll: () => setBare((now) => !now),
    onSlideList: () => setListHidden((now) => !now),
    onRulers: () => setRulers(!rulers),
    onLayoutGuides: () => setLayoutGuides(!layoutGuides),
  })
  useShortcutsKey(deck !== undefined && present.show === null, () => setShortcutsOpen((open) => !open))
  function withShortcuts(editor: ReactNode) {
    if (!shortcutsOpen || present.show !== null) return editor
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">{editor}</div>
        <ShortcutsPanel onClose={() => setShortcutsOpen(false)} />
      </div>
    )
  }
  const mode = designMode?.value
  const changeMode = designMode?.onChange
  useEffect(() => {
    if (mode === undefined || changeMode === undefined || size === null || present.show !== null) return
    function toggle(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented || typing(event.target)) return
      const gesture = gestureFor(event, "editor")
      if ((gesture !== "design-mode" && gesture !== "layers-panel") || !editorOwnsKey(event)) return
      if (document.querySelector('[role="dialog"][data-open], [role="alertdialog"][data-open]') !== null) return
      event.preventDefault()
      changeMode?.(gesture === "layers-panel" || mode === "slides" ? "design" : "slides")
    }
    window.addEventListener("keydown", toggle)
    return () => window.removeEventListener("keydown", toggle)
  }, [mode, changeMode, size, present.show])
  const presenting =
    deck === undefined ? null : (
      <PresentLayer
        present={present}
        title={title}
        count={deck.slides.count}
        size={size}
        paint={(index, width) => deck.presentPaint?.(index, width, present.go) ?? deck.slides.thumb(index, width)}
        {...(deck.notesOf === undefined ? {} : { notesOf: deck.notesOf })}
      />
    )
  const view = useRef<CanvasView>(null)
  function zoomTo(next: Zoom) {
    const aim = view.current
    if (next === "fit" || size === null || aim === null) setZoom(next)
    else aim.aim(zoomWidth(next, room, size), () => setZoom(next))
  }
  function zoomToSelection() {
    const zoomed =
      size !== null && view.current !== null && view.current.selection((next) => setZoom(widthZoom(next, size)))
    if (!zoomed) setZoom("fit")
  }
  useZoomKeys(deck !== undefined && size !== null && !gridOpen, (key) => {
    if (key === "selection") zoomToSelection()
    else if (key === "fit" || size === null) setZoom("fit")
    else zoomTo(key === "actual" ? 100 : steppedZoom(key, zoomPercent(width, size)))
  })
  const tools: ToolbarTools = {
    activeTool,
    menuOpen: toolMenu,
    panel,
    ...(deck === undefined ? {} : { pointer, undo: deck.undo }),
    ...(deck?.onSlideNumber === undefined ? {} : { onSlideNumber: deck.onSlideNumber }),
    ...(deck?.onText === undefined ? {} : { onText: deck.onText }),
    ...(deck?.onChart === undefined ? {} : { onChart: deck.onChart }),
    ...(deck?.formatting === undefined ? {} : { formatting: deck.formatting }),
    ...(deck?.tone === undefined ? {} : { tone: deck.tone }),
    ...(deck?.deckColors === undefined ? {} : { deckColors: deck.deckColors }),
    ...(formats === undefined ? {} : { formats }),
    ...(deck?.onPicture === undefined ? {} : { onPicture: deck.onPicture }),
    ...(deck?.onShape === undefined ? {} : { onShape: gridOpen ? deck.onShape : pointer.arm }),
    ...(deck?.onIcon === undefined ? {} : { onIcon: deck.onIcon }),
    ...(onPanel === undefined ? {} : { onPanel }),
    ...(designMode === undefined ? {} : { designMode }),
  }
  if (deck !== undefined && gridOpen) {
    return withShortcuts(
      <div className="relative flex h-full min-h-0">
        <div className="min-w-0 flex-1">
          <EditorGrid
            slide={deck.slide}
            onSlideSelection={setSelectedSlides}
            id={deck.id ?? null}
            title={title}
            strip={deck.slides}
            size={size}
            onSlides={() => openWith(() => setGridOpen(false))}
            onExport={deck.onExport}
            onPresent={(from) => present.start(from)}
            presenting={present.show !== null}
            pointer={pointer}
            save={deck.save ?? null}
            tools={
              onPanel === undefined
                ? tools
                : {
                    ...tools,
                    onPanel: (next) => {
                      setGridPanel(next !== panel || !gridPanel)
                      onPanel(next)
                    },
                  }
            }
            {...(deck.selection === undefined ? {} : { selection: deck.selection })}
            {...(deck.select === undefined ? {} : { select: deck.select })}
            {...(deck.onTrash === undefined ? {} : { onTrash: deck.onTrash })}
            {...(deck.onRename === undefined ? {} : { onRename: deck.onRename })}
          />
        </div>
        {!gridPanel || panel === "none" ? null : (
          <aside
            className="relative flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-white"
            data-editor-panel
          >
            {sideContent}
          </aside>
        )}
        {toast}
        {overlay}
        {presenting}
      </div>,
    )
  }
  return withShortcuts(
    <div className="relative flex h-full min-h-0" inert={present.show !== null}>
      {listShown ? (
        <SlideSidebar
          onSlideSelection={setSelectedSlides}
          run={run}
          title={title}
          {...(deck === undefined
            ? {}
            : { strip: deck.slides, onGrid: () => openWith(() => setGridOpen(true)), save: deck.save ?? null })}
          {...(deck?.onTrash === undefined ? {} : { onTrash: deck.onTrash })}
          {...(deck?.onRename === undefined ? {} : { onRename: deck.onRename })}
          layers={designMode?.value === "design" ? (deck?.layers ?? layers) : null}
        />
      ) : null}
      {rail === "images" ? (
        <>
          <ImagesPanel title={title} />
          <SlideColumn />
        </>
      ) : null}
      {rail === "shapes" ? (
        <>
          <ShapesPanel title={title} />
          <SlideColumn />
        </>
      ) : null}
      {rail === "text" ? (
        <>
          <TextPanel title={title} />
          <SlideColumn />
        </>
      ) : null}
      <div ref={canvas.onCanvas} className="relative min-w-0 flex-1" data-editor-canvas>
        <CanvasStage
          fit={zoom === "fit"}
          hand={deck !== undefined && pointer.tool === "hand"}
          pans={deck !== undefined && size !== null && present.show === null}
          width={width}
          height={size === null ? (width * 9) / 16 : (width * size.height) / size.width}
          canvasWidth={canvas.width}
          canvasHeight={canvas.height}
          overlay={canvas.overlay}
          view={view}
          {...(rulers && deck?.rulers !== undefined ? { rulers: deck.rulers() } : {})}
          {...(size === null
            ? {}
            : {
                limits: {
                  least: percentWidth(zoomRanges.slides.least, size),
                  most: percentWidth(zoomRanges.slides.most, size),
                },
                onZoom: (next: number) => setZoom(widthZoom(next, size)),
              })}
        >
          <div data-slide-wrapper className="relative" style={{ width }}>
            <span
              className="absolute inset-x-0 bottom-full mb-3 text-[length:var(--type-dense)] text-quiet"
              data-slide-label
            >
              {slideLabel}
            </span>
            {deck === undefined ? (
              <RevenueSlide width={width} working={working} selected={run === "compose"} />
            ) : (
              deck.slide(
                width,
                { rulers, layoutGuides },
                deck.onText === undefined || pointer.tool !== "text"
                  ? undefined
                  : (place) => {
                      pointer.pick("move")
                      deck.onText?.(place)
                    },
                shapeDrawing(pointer, deck.onShape),
              )
            )}
          </div>
        </CanvasStage>
        <div
          ref={canvas.onOverlay}
          data-canvas-overlay
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center pb-4"
        >
          {notes === undefined || bare ? null : (
            <>
              <div data-notes-width style={{ width: Math.min(width, room.width) }}>
                <NotesBar
                  text={run === "working" ? "" : notes}
                  {...(onNotes === undefined ? {} : { onEdit: onNotes })}
                />
              </div>
              <span className="block h-3" />
            </>
          )}
          {bare ? null : (
            <div className="w-full px-4">
              <EditorToolbar {...tools} textTool />
            </div>
          )}
        </div>
        {shapeTray ? (
          <div className="absolute inset-x-0 bottom-[72px] flex justify-center">
            <ShapeTray />
          </div>
        ) : null}
      </div>
      {bare ? null : (
        <ResizablePanel panel={panel === "design" ? "design" : "agent"}>
          <PanelHead>
            {deck === undefined ? (
              <ZoomReadout value="64%" />
            ) : size === null ? (
              <span />
            ) : (
              <ZoomMenu
                zoom={zoom}
                percent={zoomPercent(width, size)}
                onZoom={zoomTo}
                {...(deck.rulers === undefined
                  ? {}
                  : {
                      rulers: { shown: rulers, onChange: setRulers },
                      layoutGuides: { shown: layoutGuides, onChange: setLayoutGuides },
                    })}
                {...(deck.selection === undefined || deck.selection.ids.length === 0
                  ? {}
                  : { onSelection: zoomToSelection })}
              />
            )}
            <span className="flex items-center gap-1">
              <PresentButton
                ref={presentButton}
                {...(deck === undefined ? {} : { onClick: () => present.start(deck.slides.current) })}
              />
              <ExportControl
                {...(deck === undefined
                  ? {}
                  : {
                      target: {
                        name: title,
                        count: deck.slides.count,
                        current: deck.slides.current,
                        size,
                        slide: deck.slides.thumb,
                        onExport: deck.onExport,
                      },
                    })}
              />
            </span>
          </PanelHead>
          {sideContent}
        </ResizablePanel>
      )}
      {templatePicker ? <TemplatePicker /> : null}
      {toast}
      {overlay}
      {presenting}
    </div>,
  )
}
