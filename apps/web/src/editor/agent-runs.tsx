import * as doom from "@airdesign/doom"
import { useState } from "react"
import { EditorIcon } from "@/components/ui/editor-icons"
import {
  agentKeptLayers,
  agentLeftLayers,
  agentRunStatus,
  agentRunsCopy,
  agentShownName,
  type RunPlace,
} from "@/copy/agent-runs-copy"
import { productCopy } from "@/copy/product-copy"
import { LiveDot, slideNumberOf } from "./agent-at-work"
import { layerLabel } from "./layer-label"
import type { EditorClient } from "./use-doom-deck"

type Undoing =
  | "undoing"
  | { readonly kept: readonly string[]; readonly left: readonly string[] }
  | "nothing"
  | "refused"
  | "failed"

const said: Partial<Record<Extract<Undoing, string>, string>> = {
  nothing: agentRunsCopy.nothingLeft,
  refused: agentRunsCopy.undoRefused,
  failed: agentRunsCopy.undoFailed,
}

function placeOf(view: doom.Doom, run: doom.ListedRun): RunPlace {
  if (run.slide === undefined) return "deck"
  const slide = slideNumberOf(view, run.slide)
  return slide === undefined ? "gone" : { slide }
}

const rowText = "text-xs leading-[var(--leading-dense)]"

export function AgentRuns({
  view,
  editing,
  undoRun,
}: {
  readonly view: doom.Doom
  readonly editing: ReadonlySet<string>
  readonly undoRun: EditorClient["undoRun"]
}) {
  const [undoing, setUndoing] = useState<ReadonlyMap<string, Undoing>>(new Map())
  const runs = doom.runsOf(view)
  if (runs.length === 0) return null

  async function undo(run: doom.ListedRun) {
    const mark = (state: Undoing) => setUndoing((now) => new Map(now).set(run.id, state))
    mark("undoing")
    const turned = await undoRun(run.id)
    const named = (ids: readonly doom.NodeId[]) => ids.map((id) => layerLabel(view, id))
    if (turned.ok) mark({ kept: named(turned.kept), left: named(turned.left) })
    else if (turned.reason === "left") mark({ kept: [], left: named(turned.left) })
    else mark(turned.reason === "offline" ? "failed" : turned.reason === "nothing" ? "nothing" : "refused")
  }

  return (
    <section aria-label={agentRunsCopy.title} data-agent-runs="" className="shrink-0 border-b border-line px-3 pb-2">
      <h2 className="flex h-7 items-center text-[length:var(--type-caption)] text-muted-foreground">
        {agentRunsCopy.title}
      </h2>
      <ul className="max-h-[7.5rem] overflow-x-hidden overflow-y-auto">
        {runs.map((run) => {
          const state = undoing.get(run.id)
          const live = editing.has(run.id)
          const name = agentShownName(run.name)
          const status = run.undone ? agentRunsCopy.undone : agentRunStatus(live, placeOf(view, run))
          const note =
            typeof state === "object"
              ? [
                  ...(state.kept.length === 0 || !run.undone ? [] : [agentKeptLayers(name, state.kept)]),
                  ...(state.left.length === 0 ? [] : [agentLeftLayers(state.left)]),
                ].join(" ") || undefined
              : state === undefined || state === "undoing"
                ? undefined
                : said[state]
          return (
            <li key={run.id} data-agent-run={run.id} className="flex flex-col py-0.5">
              <span className={`flex h-6 items-center gap-2 ${rowText}`}>
                <span className="min-w-0 truncate text-foreground">{name}</span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-muted-foreground">
                  {live ? <LiveDot /> : null}
                  <span className="truncate">{status}</span>
                </span>
                {live || run.undone ? null : (
                  <button
                    type="button"
                    data-agent-run-undo=""
                    className="flex h-6 shrink-0 items-center gap-1.5 rounded-[var(--shape-control)] px-1.5 text-muted-foreground outline-hidden [transition:color_var(--ease-micro)] hover:text-foreground disabled:opacity-50"
                    disabled={state === "undoing"}
                    onClick={() => void undo(run)}
                  >
                    <EditorIcon name="undo" size={13} />
                    {productCopy.undo}
                  </button>
                )}
              </span>
              {note === undefined ? null : (
                <p className={`pb-1 text-muted-foreground ${rowText}`} data-agent-run-note="">
                  {note}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
