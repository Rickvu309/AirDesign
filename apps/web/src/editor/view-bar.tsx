import type { ReactNode } from "react"

export function ViewBar({ zoom, children }: { zoom: ReactNode; children: ReactNode }) {
  return (
    <div className="ml-auto flex items-center gap-1" data-view-bar>
      {zoom}
      <span aria-hidden="true" className="mx-0.5 block h-5 w-px bg-[var(--field-edge)]" />
      {children}
    </div>
  )
}
