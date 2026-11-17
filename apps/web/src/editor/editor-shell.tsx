import { useRef, useState, type ReactNode } from "react"
import { NotesBar } from "@/editor/notes-bar"
import { CanvasStage } from "@/editor/canvas-stage"
import {
  fitWidth,
  slideRoom,
  steppedZoom,
  zoomPercent,
  zoomWidth,
  type SlideSize,
  type Zoom,
} from "@/editor/canvas-zoom"
import { PanelHead, ZoomReadout } from "@/editor/editor-chrome"
import { openWith } from "@/editor/slide-opening"
import { EditorGrid } from "@/editor/editor-grid"
import { EditorToolbar, type EditorPanel, type EditorTool } from "@/editor/editor-toolbar"
import { TableSizeGrid } from "@/editor/table-tool"
import type { TableSize } from "@/element-edit"
import { usePointerTool } from "@/editor/pointer-tool"
import { RevenueSlide } from "@/editor/revenue-slide"
import { SlideSidebar, type SidebarRun, type SlideStrip } from "@/editor/slide-sidebar"
import type { UndoButtonsState } from "@/editor/undo-buttons"
import type { FormatShown } from "@/editor/format-buttons"
import type { TextFormatting } from "@airdesign/render"
import type { Geometry } from "@airdesign/document"
import type { SaveStatus } from "@/editor/use-deck-status"
import { ImagesPanel, ShapesPanel, ShapeTray, SlideColumn, TemplatePicker, TextPanel } from "@/editor/tool-panels"
import { useCanvasRoom } from "@/editor/use-canvas-room"
import { useZoomKeys } from "@/editor/zoom-keys"
import { ZoomMenu } from "@/editor/zoom-menu"
import { ExportControl } from "@/export/export-control"
import type { ExportRequest } from "@/export/export-deck"
import { PresentButton } from "@/present/present-button"
import { usePresentKeys } from "@/present/present-keys"
import { PresentLayer } from "@/present/present-layer"
import type { ShownSlide } from "@/present/slide-shows"
import { usePresent } from "@/present/use-present"

const shownSize = { rows: 4, columns: 3 }

export type EditorRail = "slides" | "images" | "shapes" | "text"

export type EditorDeck = {
  readonly id?: string
  readonly slides: SlideStrip
  readonly size: SlideSize | null
  readonly slide: (width: number) => ReactNode
  readonly onExport: (request?: ExportRequest) => Promise<void> | void
  readonly undo: UndoButtonsState
  readonly onText?: () => void
  readonly onRename?: (name: string) => void
  readonly formatting?: TextFormatting
  readonly deckColors?: readonly string[]
  readonly onTable?: (size: TableSize) => void
  readonly onPicture?: (file: File) => void
  readonly onShape?: (geometry: Geometry) => void
  readonly onIcon?: (name: string) => void
  readonly save?: SaveStatus | null
  readonly notesOf?: (index: number) => string
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
  tablePicker?: boolean
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
  tablePicker = false,
  toast,
  overlay,
  formats,
  deck,
}: EditorShellProps) {
  const canvas = useCanvasRoom()
  const room = (deck === undefined ? null : canvas.room) ?? slideRoom(rail === "slides" ? 800 : 720)
  const [zoom, setZoom] = useState<Zoom>("fit")
  const [gridOpen, setGridOpen] = useState(false)
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
        paint={deck.slides.thumb}
        {...(deck.notesOf === undefined ? {} : { notesOf: deck.notesOf })}
      />
    )
  useZoomKeys(deck !== undefined && size !== null && !gridOpen, (key) =>
    setZoom(key === "fit" || size === null ? "fit" : steppedZoom(key, zoomPercent(width, size))),
  )
  if (deck !== undefined && gridOpen) {
    return (
      <EditorGrid
        id={deck.id ?? null}
        title={title}
        strip={deck.slides}
        size={size}
        onSlides={() => openWith(() => setGridOpen(false))}
        onExport={deck.onExport}
        undo={deck.undo}
        pointer={pointer}
        panel={panel}
        activeTool={activeTool}
        toolMenu={toolMenu}
        save={deck.save ?? null}
        {...(deck.onRename === undefined ? {} : { onRename: deck.onRename })}
        {...(deck.onText === undefined ? {} : { onText: deck.onText })}
        {...(deck.formatting === undefined ? {} : { formatting: deck.formatting })}
        {...(formats === undefined ? {} : { formats })}
        {...(deck.onTable === undefined ? {} : { onTable: deck.onTable })}
        {...(deck.onPicture === undefined ? {} : { onPicture: deck.onPicture })}
        {...(onPanel === undefined ? {} : { onPanel })}
      />
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
      <div
        ref={deck === undefined ? undefined : canvas.onCanvas}
        className="relative min-w-0 flex-1"
        data-editor-canvas
      >
        <CanvasStage hand={deck !== undefined && pointer.tool === "hand"} width={width}>
          <div className="flex flex-col gap-3" style={{ width }}>
            <span className="text-[length:var(--type-dense)] text-quiet" data-slide-label>
              {slideLabel}
            </span>
            {deck === undefined ? (
              <RevenueSlide width={width} working={working} selected={run === "compose"} />
            ) : (
              deck.slide(width)
            )}
          </div>
        </CanvasStage>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center pb-4">
          {notes === undefined ? null : (
            <>
              <div style={{ width }}>
                <NotesBar
                  text={run === "working" ? "" : notes}
                  {...(onNotes === undefined ? {} : { onEdit: onNotes })}
                />
              </div>
              <span className="block h-3" />
            </>
          )}
          <div className="w-full px-4">
            <EditorToolbar
              activeTool={activeTool}
              menuOpen={toolMenu}
              panel={panel}
              {...(deck === undefined ? {} : { pointer })}
              {...(deck === undefined ? {} : { undo: deck.undo })}
              {...(deck?.onText === undefined ? {} : { onText: deck.onText })}
              {...(deck?.formatting === undefined ? {} : { formatting: deck.formatting })}
              {...(deck?.deckColors === undefined ? {} : { deckColors: deck.deckColors })}
              {...(formats === undefined ? {} : { formats })}
              {...(deck?.onTable === undefined ? {} : { onTable: deck.onTable })}
              {...(deck?.onPicture === undefined ? {} : { onPicture: deck.onPicture })}
              {...(deck?.onShape === undefined ? {} : { onShape: deck.onShape })}
              {...(deck?.onIcon === undefined ? {} : { onIcon: deck.onIcon })}
              {...(onPanel === undefined ? {} : { onPanel })}
            />
          </div>
        </div>
        {shapeTray || tablePicker ? (
          <div className="absolute inset-x-0 bottom-[72px] flex justify-center">
            {shapeTray ? <ShapeTray /> : <TableSizeGrid picked={shownSize} onPick={() => {}} onSize={() => {}} />}
          </div>
        ) : null}
      </div>
      <aside
        className="relative flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-white"
        data-editor-panel
      >
        <PanelHead>
          {deck === undefined ? (
            <ZoomReadout value="64%" />
          ) : size === null ? (
            <span />
          ) : (
            <ZoomMenu
              zoom={zoom}
              percent={zoomPercent(width, size)}
              fitPercent={zoomPercent(fitWidth(room, size), size)}
              onZoom={setZoom}
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
        {side}
      </aside>
      {templatePicker ? <TemplatePicker /> : null}
      {toast}
      {overlay}
      {presenting}
    </div>
  )
}
