import type { ReactNode } from "react"
import { AgentPanel } from "@/editor/agent-panel"
import { DesignPanel } from "@/editor/design-panel"
import { ExportButton, Island } from "@/editor/editor-chrome"
import { EditorToolbar, type EditorPanel, type EditorTool } from "@/editor/editor-toolbar"
import { RevenueSlide } from "@/editor/revenue-slide"
import { SlideSidebar, type SidebarRun, type SlideStrip } from "@/editor/slide-sidebar"
import {
  ActionsMenu,
  ImagesPanel,
  ShapesPanel,
  ShapeTray,
  SlideColumn,
  TemplatePicker,
  TextPanel,
} from "@/editor/tool-panels"

export type EditorRail = "slides" | "images" | "shapes" | "text"

export type EditorShellProps = {
  title: string
  slideLabel: string
  notes?: string
  run?: SidebarRun
  panel?: EditorPanel
  rail?: EditorRail
  activeTool?: EditorTool
  toolMenu?: boolean
  usageOpen?: boolean
  templatePicker?: boolean
  shapeTray?: boolean
  actionsMenu?: boolean
  toast?: ReactNode
  overlay?: ReactNode
  slide?: (width: number) => ReactNode
  slides?: SlideStrip
  onExport?: () => void
}

export function EditorShell({
  title,
  slideLabel,
  notes,
  run = "done",
  panel = "agent",
  rail = "slides",
  activeTool = "move",
  toolMenu = false,
  usageOpen = false,
  templatePicker = false,
  shapeTray = false,
  actionsMenu = false,
  toast,
  overlay,
  slide,
  slides,
  onExport,
}: EditorShellProps) {
  const width = rail === "slides" ? 800 : 720
  const working = run === "working" || run === "own"
  return (
    <div className="relative flex h-full min-h-0">
      {rail === "slides" ? (
        <SlideSidebar run={run} title={title} {...(slides === undefined ? {} : { strip: slides })} />
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
      <div className="relative flex min-w-0 flex-1 flex-col items-center pt-14 pb-4">
        <div className="flex flex-col gap-3" style={{ width }}>
          <span className="text-[length:var(--type-dense)] text-faint">{slideLabel}</span>
          {slide === undefined ? (
            <RevenueSlide width={width} working={working} selected={run === "compose"} />
          ) : (
            slide(width)
          )}
        </div>
        <span className="block flex-1" />
        {notes === undefined ? null : (
          <>
            <span className="block h-1 w-12 rounded-full bg-[var(--dot)]" />
            <span className="block h-2" />
            <div className="flex h-12 items-center rounded-[var(--shape-card)] bg-line px-4" style={{ width }}>
              <span className={cnTone(run === "working")}>{run === "working" ? "Add speaker notes" : notes}</span>
            </div>
            <span className="block h-3" />
          </>
        )}
        <EditorToolbar activeTool={activeTool} menuOpen={toolMenu} panel={panel} />
        {shapeTray || actionsMenu ? (
          <div className="absolute inset-x-0 bottom-[72px] flex justify-center">
            {shapeTray ? <ShapeTray /> : <ActionsMenu />}
          </div>
        ) : null}
      </div>
      {panel === "design" ? <DesignPanel /> : null}
      {panel === "agent" ? (
        <AgentPanel run={run} usageOpen={usageOpen} {...(onExport === undefined ? {} : { onExport })} />
      ) : null}
      {panel === "none" ? (
        <Island className="absolute top-3 right-3">
          <ExportButton {...(onExport === undefined ? {} : { onClick: onExport })} />
        </Island>
      ) : null}
      {templatePicker ? <TemplatePicker /> : null}
      {toast}
      {overlay}
    </div>
  )
}

function cnTone(empty: boolean) {
  return empty
    ? "truncate text-[length:var(--type-dense)] text-faint"
    : "truncate text-[length:var(--type-dense)] text-quiet"
}
