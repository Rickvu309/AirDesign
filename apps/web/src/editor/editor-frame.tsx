import type { ReactNode } from "react"

export function EditorFrame({ top, children }: { top?: ReactNode; children: ReactNode }) {
  return (
    <div className="screen-frame">
      <div className="flex h-full flex-col bg-canvas">
        {top}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
