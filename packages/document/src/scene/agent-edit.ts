import type { AgentChange, AgentRefusal } from "./agent-change.js"
import { compileAgentChange, nameOf } from "./agent-compile.js"
import type { Reading } from "./agent-draft.js"
import type { NodeId } from "./ids.js"
import { rev } from "./ids.js"
import { applyEdit } from "./apply-edit.js"
import { isRefusal } from "./refusal.js"
import type { Author, Edit, Scene, Write } from "./scene.js"
import { onTop } from "./view-of.js"

export type AgentEdit = { readonly edit: Edit; readonly added: readonly NodeId[] }
export type EditBy = {
  readonly author: Author
  readonly once: string
  readonly mint: () => NodeId
  readonly read?: Scene
  readonly boxes?: Reading["boxes"]
}

export function compileAgentEdit(scene: Scene, changes: readonly AgentChange[], by: EditBy): AgentEdit | AgentRefusal {
  if (changes.length === 0) return { refused: "shape", change: "changes" }
  const reading: Reading = { read: by.read ?? scene, ...(by.boxes === undefined ? {} : { boxes: by.boxes }) }
  const writes: Write[] = []
  const ends: number[] = []
  let view = scene
  for (const [at, change] of changes.entries()) {
    const compiled = compileAgentChange(view, change, by.mint, reading)
    if ("refused" in compiled) return { ...compiled, at }
    const next = applyEdit(view, {
      ...onTop(view, { once: `${by.once}#${at}`, author: by.author, writes: compiled }),
      rev: rev(view.rev + 1),
    })
    if (isRefusal(next)) return { ...next, change: nameOf(change), at }
    view = next
    writes.push(...compiled)
    ends.push(writes.length)
  }
  const edit: Edit = { once: by.once, author: by.author, writes }
  const landed = applyEdit(scene, { ...edit, rev: rev(scene.rev + 1) })
  if (isRefusal(landed)) {
    const index = writes.findIndex(
      (write) => write.node === landed.node && (landed.prop === undefined || write.prop === landed.prop),
    )
    const at = Math.max(
      0,
      ends.findIndex((end) => end > index),
    )
    return { ...landed, change: nameOf(changes[at] as AgentChange), at }
  }
  return {
    edit,
    added: writes.filter((write) => write.prop === "type" && !scene.nodes.has(write.node)).map((write) => write.node),
  }
}
