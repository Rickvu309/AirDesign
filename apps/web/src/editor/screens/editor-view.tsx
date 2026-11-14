import type { ReactNode } from "react"
import { AgentPanel } from "@/editor/agent-panel"
import { DesignPanel } from "@/editor/design-panel"
import { EditorFrame } from "@/editor/editor-frame"
import { EditorShell, type EditorShellProps } from "@/editor/editor-shell"

export type EditorViewProps = Omit<EditorShellProps, "side" | "deck"> & {
  usageOpen?: boolean
  designed?: ReactNode
}

export function EditorView({ panel = "agent", usageOpen = false, designed, ...props }: EditorViewProps) {
  const side =
    panel === "agent" ? (
      <AgentPanel run={props.run ?? "done"} usageOpen={usageOpen} />
    ) : panel === "design" ? (
      (designed ?? <DesignPanel />)
    ) : null
  return (
    <EditorFrame>
      <EditorShell {...props} panel={panel} side={side} />
    </EditorFrame>
  )
}
