import type { ReactNode } from "react"
import { AgentPanel } from "@/editor/agent-panel"
import { DesignPanel } from "@/editor/design-panel"
import { EditorToolbar, type EditorTool } from "@/editor/editor-toolbar"
import { RevenueSlide } from "@/editor/revenue-slide"
import { SlideSidebar, type SidebarRun } from "@/editor/slide-sidebar"
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
  run?: SidebarRun
  panel?: "agent" | "design"
  rail?: EditorRail
  activeTool?: EditorTool
  toolMenu?: boolean
  usageOpen?: boolean
  templatePicker?: boolean
  shapeTray?: boolean
  actionsMenu?: boolean
  toast?: ReactNode
  overlay?: ReactNode
}

const notes = "Lead with the trend, then the Q3 number. Mention the two enterprise deals."

export function EditorShell({
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
}: EditorShellProps) {
  const width = rail === "slides" ? 800 : 720
  const working = run === "working" || run === "own"
  return (
    <div className="relative flex h-full min-h-0">
      {rail === "slides" ? <SlideSidebar run={run} /> : null}
      {rail === "images" ? (
        <>
          <ImagesPanel />
          <SlideColumn />
        </>
      ) : null}
      {rail === "shapes" ? (
        <>
          <ShapesPanel />
          <SlideColumn />
        </>
      ) : null}
      {rail === "text" ? (
        <>
          <TextPanel />
          <SlideColumn />
        </>
      ) : null}
      <div className="relative flex min-w-0 flex-1 flex-col items-center pt-14 pb-4">
        <div className="flex flex-col gap-3" style={{ width }}>
          <span className="text-[13px] text-faint">3</span>
          <RevenueSlide width={width} working={working} selected={run === "compose"} />
        </div>
        <span className="block flex-1" />
        <span className="block h-1 w-12 rounded-full bg-[var(--dot)]" />
        <span className="block h-2" />
        <div className="flex h-12 items-center rounded-[10px] bg-line px-4" style={{ width }}>
          <span className={cnTone(run === "working")}>{run === "working" ? "Add speaker notes" : notes}</span>
        </div>
        <span className="block h-3" />
        <EditorToolbar activeTool={activeTool} menuOpen={toolMenu} panel={panel} />
        {shapeTray || actionsMenu ? (
          <div className="absolute inset-x-0 bottom-[72px] flex justify-center">
            {shapeTray ? <ShapeTray /> : <ActionsMenu />}
          </div>
        ) : null}
      </div>
      {panel === "design" ? <DesignPanel /> : <AgentPanel run={run} usageOpen={usageOpen} />}
      {templatePicker ? <TemplatePicker /> : null}
      {toast}
      {overlay}
    </div>
  )
}

function cnTone(empty: boolean) {
  return empty ? "truncate text-[13px] text-faint" : "truncate text-[13px] text-quiet"
}
