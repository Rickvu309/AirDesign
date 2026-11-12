import { useState, type ReactNode } from "react"
import { NotesBar } from "@/editor/notes-bar"
import { CanvasStage } from "@/editor/canvas-stage"
import { fitWidth, slideRoom, zoomPercent, zoomWidth, type SlideSize, type Zoom } from "@/editor/canvas-zoom"
import { ExportButton, PanelHead, ZoomReadout } from "@/editor/editor-chrome"
import { EditorToolbar, type EditorPanel, type EditorTool } from "@/editor/editor-toolbar"
import { usePointerTool } from "@/editor/pointer-tool"
import { RevenueSlide } from "@/editor/revenue-slide"
import { SlideSidebar, type SidebarRun, type SlideStrip } from "@/editor/slide-sidebar"
import type { UndoButtonsState } from "@/editor/undo-buttons"
import {
  ActionsMenu,
  ImagesPanel,
  ShapesPanel,
  ShapeTray,
  SlideColumn,
  TemplatePicker,
  TextPanel,
} from "@/editor/tool-panels"
import { ZoomMenu } from "@/editor/zoom-menu"

export type EditorRail = "slides" | "images" | "shapes" | "text"

export type EditorDeck = {
  readonly slides: SlideStrip
  readonly size: SlideSize | null
  readonly slide: (width: number) => ReactNode
  readonly onExport: () => void
  readonly undo: UndoButtonsState
  readonly onText?: () => void
  readonly onRename?: (name: string) => void
  readonly onTable?: () => void
}

export type EditorShellProps = {
  title: string
  slideLabel: string
  notes?: string
  onNotes?: (text: string) => void
  notesLocked?: string
  run?: SidebarRun
  panel?: EditorPanel
  onPanel?: (panel: Exclude<EditorPanel, "none">) => void
  side?: ReactNode
  rail?: EditorRail
  activeTool?: EditorTool
  toolMenu?: boolean
  templatePicker?: boolean
  shapeTray?: boolean
  actionsMenu?: boolean
  toast?: ReactNode
  overlay?: ReactNode
  deck?: EditorDeck
}

export function EditorShell({
  title,
  slideLabel,
  notes,
  onNotes,
  notesLocked,
  run = "done",
  panel = "none",
  onPanel,
  side,
  rail = "slides",
  activeTool = "move",
  toolMenu = false,
  templatePicker = false,
  shapeTray = false,
  actionsMenu = false,
  toast,
  overlay,
  deck,
}: EditorShellProps) {
  const room = slideRoom(rail === "slides" ? 800 : 720)
  const [zoom, setZoom] = useState<Zoom>("fit")
  const pointer = usePointerTool(deck !== undefined)
  const size = deck?.size ?? null
  const width = size === null ? room.width : zoomWidth(zoom, room, size)
  const working = run === "working" || run === "own"
  return (
    <div className="relative flex h-full min-h-0">
      {rail === "slides" ? (
        <SlideSidebar
          run={run}
          title={title}
          {...(deck === undefined ? {} : { strip: deck.slides })}
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
      <div className="relative min-w-0 flex-1" data-editor-canvas>
        <CanvasStage hand={deck !== undefined && pointer.tool === "hand"} width={width}>
          <div className="flex flex-col gap-3" style={{ width }}>
            <span className="text-[length:var(--type-dense)] text-faint" data-slide-label>
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
                  {...(notesLocked === undefined ? {} : { locked: notesLocked })}
                />
              </div>
              <span className="block h-3" />
            </>
          )}
          <div className="pointer-events-auto">
            <EditorToolbar
              activeTool={activeTool}
              menuOpen={toolMenu}
              panel={panel}
              {...(deck === undefined ? {} : { pointer })}
              {...(deck === undefined ? {} : { undo: deck.undo })}
              {...(deck?.onText === undefined ? {} : { onText: deck.onText })}
              {...(deck?.onTable === undefined ? {} : { onTable: deck.onTable })}
              {...(onPanel === undefined ? {} : { onPanel })}
            />
          </div>
        </div>
        {shapeTray || actionsMenu ? (
          <div className="absolute inset-x-0 bottom-[72px] flex justify-center">
            {shapeTray ? <ShapeTray /> : <ActionsMenu />}
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
          <ExportButton faded={run === "offline"} {...(deck === undefined ? {} : { onClick: deck.onExport })} />
        </PanelHead>
        {side}
      </aside>
      {templatePicker ? <TemplatePicker /> : null}
      {toast}
      {overlay}
    </div>
  )
}
