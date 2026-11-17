import { useRef, useState, type ReactNode } from "react"
import { ResizablePanel } from "@/editor/resizable-panel"
import { NotesBar } from "@/editor/notes-bar"
import { CanvasStage } from "@/editor/canvas-stage"
import { slideRoom, steppedZoom, zoomPercent, zoomWidth, type SlideSize, type Zoom } from "@/editor/canvas-zoom"
import { PanelHead, ZoomReadout } from "@/editor/editor-chrome"
import { openWith } from "@/editor/slide-opening"
import { EditorGrid } from "@/editor/editor-grid"
import { EditorToolbar, type EditorPanel, type EditorTool } from "@/editor/editor-toolbar"
import { usePointerTool } from "@/editor/pointer-tool"
import { RevenueSlide } from "@/editor/revenue-slide"
import { SlideSidebar, type SidebarRun, type SlideStrip } from "@/editor/slide-sidebar"
import type { UndoButtonsState } from "@/editor/undo-buttons"
import type { FormatShown } from "@/editor/format-buttons"
import type { Selection, TextFormatting } from "@airdesign/render"
import type { Geometry } from "@airdesign/document"
import type { SaveStatus } from "@/editor/use-deck-status"
import { ImagesPanel, ShapesPanel, ShapeTray, SlideColumn, TemplatePicker, TextPanel } from "@/editor/tool-panels"
import { useCanvasRoom } from "@/editor/use-canvas-room"
import type { ToolbarTools } from "@/editor/toolbar-tools"
import { useZoomKeys } from "@/editor/zoom-keys"
import { ZoomMenu } from "@/editor/zoom-menu"
import { ExportControl } from "@/export/export-control"
import type { ExportRequest } from "@/export/export-deck"
import { PresentButton } from "@/present/present-button"
import { usePresentKeys } from "@/present/present-keys"
import { PresentLayer } from "@/present/present-layer"
import type { ShownSlide } from "@/present/slide-shows"
import { usePresent } from "@/present/use-present"

export type EditorRail = "slides" | "images" | "shapes" | "text"

export type EditorDeck = {
  readonly id?: string
  readonly slides: SlideStrip
  readonly size: SlideSize | null
  readonly slide: (width: number) => ReactNode
  readonly onExport: (request?: ExportRequest) => Promise<void> | void
  readonly undo: UndoButtonsState
  readonly selection?: Selection
  readonly select?: (selection: Selection) => void
  readonly onText?: () => void
  readonly onTrash?: () => void
  readonly onRename?: (name: string) => void
  readonly formatting?: TextFormatting
  readonly deckColors?: readonly string[]
  readonly onPicture?: (file: File) => void
  readonly onShape?: (geometry: Geometry) => void
  readonly onIcon?: (name: string) => void
  readonly save?: SaveStatus | null
  readonly notesOf?: (index: number) => string
  readonly presentPaint?: (index: number, width: number, go: (index: number) => void) => ReactNode
  readonly shows?: () => readonly ShownSlide[]
}

export type EditorShellProps = {
  title: string
  slideLabel: string
  notes?: string
  onNotes?: (text: string) => void
  run?: SidebarRun
  panel?: EditorPanel
  onPanel?: (panel: Exclude<EditorPanel, "none">) => void
  side?: ReactNode
  rail?: EditorRail
  activeTool?: EditorTool
  toolMenu?: boolean
  templatePicker?: boolean
  shapeTray?: boolean
  toast?: ReactNode
  overlay?: ReactNode
  formats?: FormatShown
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
  side,
  rail = "slides",
  activeTool = "move",
  toolMenu = false,
  templatePicker = false,
  shapeTray = false,
  toast,
  overlay,
  formats,
  deck,
}: EditorShellProps) {
  const canvas = useCanvasRoom()
  const room = (deck === undefined ? null : canvas.room) ?? slideRoom(rail === "slides" ? 800 : 720)
  const [zoom, setZoom] = useState<Zoom>("fit")
  const [gridOpen, setGridOpen] = useState(false)
  const [gridPanel, setGridPanel] = useState(false)
  const pointer = usePointerTool(deck !== undefined)
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
          onLand: (at) => {
            strip.onSelect(at)
            setTimeout(() => presentButton.current?.focus({ preventScroll: true }))
          },
        },
  )
  usePresentKeys(strip !== undefined && !gridOpen && present.show === null, (from) =>
    present.start(from === "first" ? 0 : (strip?.current ?? 0)),
  )
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
  useZoomKeys(deck !== undefined && size !== null && !gridOpen, (key) =>
    setZoom(key === "fit" || key === "selection" || size === null ? "fit" : steppedZoom(key, zoomPercent(width, size))),
  )
  const tools: ToolbarTools = {
    activeTool,
    menuOpen: toolMenu,
    panel,
    ...(deck === undefined ? {} : { pointer, undo: deck.undo }),
    ...(deck?.onText === undefined ? {} : { onText: deck.onText }),
    ...(deck?.formatting === undefined ? {} : { formatting: deck.formatting }),
    ...(deck?.deckColors === undefined ? {} : { deckColors: deck.deckColors }),
    ...(formats === undefined ? {} : { formats }),
    ...(deck?.onPicture === undefined ? {} : { onPicture: deck.onPicture }),
    ...(deck?.onShape === undefined ? {} : { onShape: deck.onShape }),
    ...(deck?.onIcon === undefined ? {} : { onIcon: deck.onIcon }),
    ...(onPanel === undefined ? {} : { onPanel }),
  }
  if (deck !== undefined && gridOpen) {
    return (
      <div className="relative flex h-full min-h-0">
        <div className="min-w-0 flex-1">
          <EditorGrid
            slide={deck.slide}
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
            {side}
          </aside>
        )}
        {toast}
        {overlay}
        {presenting}
      </div>
    )
  }
  return (
    <div className="relative flex h-full min-h-0" inert={present.show !== null}>
      {rail === "slides" ? (
        <SlideSidebar
          run={run}
          title={title}
          {...(deck === undefined
            ? {}
            : { strip: deck.slides, onGrid: () => openWith(() => setGridOpen(true)), save: deck.save ?? null })}
          {...(deck?.onTrash === undefined ? {} : { onTrash: deck.onTrash })}
          {...(deck?.onRename === undefined ? {} : { onRename: deck.onRename })}
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
          width={width}
          height={size === null ? (width * 9) / 16 : (width * size.height) / size.width}
          canvasHeight={canvas.height}
          overlay={canvas.overlay}
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
              deck.slide(width)
            )}
          </div>
        </CanvasStage>
        <div
          ref={canvas.onOverlay}
          data-canvas-overlay
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center pb-4"
        >
          {notes === undefined ? null : (
            <>
              <div data-notes-width style={{ width }}>
                <NotesBar
                  text={run === "working" ? "" : notes}
                  {...(onNotes === undefined ? {} : { onEdit: onNotes })}
                />
              </div>
              <span className="block h-3" />
            </>
          )}
          <div className="w-full px-4">
            <EditorToolbar {...tools} />
          </div>
        </div>
        {shapeTray ? (
          <div className="absolute inset-x-0 bottom-[72px] flex justify-center">
            <ShapeTray />
          </div>
        ) : null}
      </div>
      <ResizablePanel panel={panel === "design" ? "design" : "agent"}>
        <PanelHead>
          {deck === undefined ? (
            <ZoomReadout value="64%" />
          ) : size === null ? (
            <span />
          ) : (
            <ZoomMenu zoom={zoom} percent={zoomPercent(width, size)} onZoom={setZoom} />
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
        {side}
      </ResizablePanel>
      {templatePicker ? <TemplatePicker /> : null}
      {toast}
      {overlay}
      {presenting}
    </div>
  )
}
