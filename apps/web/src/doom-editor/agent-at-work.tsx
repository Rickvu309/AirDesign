import * as doom from "@airdesign/doom"
import { agentEditingMark, agentShownName } from "@/copy/agent-runs-copy"
import { slidesOf } from "@/editing/node-props"

export function LiveDot() {
  return <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary motion-safe:animate-pulse" />
}

export function slideNumberOf(view: doom.Doom, slide: doom.NodeId | undefined): number | undefined {
  const at = slide === undefined ? -1 : slidesOf(view).indexOf(slide)
  return at < 0 ? undefined : at + 1
}

export function AgentAtWork({
  view,
  editing,
  slide,
  onOpen,
}: {
  readonly view: doom.Doom
  readonly editing: ReadonlySet<string>
  readonly slide: doom.NodeId
  readonly onOpen: () => void
}) {
  const live = doom.liveRuns(view).filter((run) => editing.has(run.id))
  const [only] = live
  if (only === undefined) return null
  const names = [...new Set(live.map((run) => agentShownName(run.name)))]
  const at = { here: live.length === 1 && only.slide === slide, slide: slideNumberOf(view, only.slide) }
  return (
    <button
      type="button"
      data-agent-at-work=""
      className="pointer-events-auto flex min-w-0 items-center gap-1.5 rounded-[var(--shape-control)] text-quiet outline-hidden [transition:color_var(--ease-micro)] hover:text-foreground focus-visible:text-foreground"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onOpen}
    >
      <LiveDot />
      <span className="truncate">{agentEditingMark(names, at)}</span>
    </button>
  )
}
