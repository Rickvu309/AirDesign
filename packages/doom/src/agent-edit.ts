import type { RevisionKey } from "./doom.js"
import type { AgentChange, AgentRefusal } from "./agent-change.js"
import { compileAgentChange, nameOf } from "./agent-compile.js"
import type { Reading } from "./agent-draft.js"
import type { Measure } from "./measure.js"
import type { NodeId, Rev } from "./ids.js"
import { rev } from "./ids.js"
import { kindOf } from "./agent-read.js"
import { applyEdit, applyStep, countsOf } from "./apply-edit.js"
import { changingWrites } from "./changing-writes.js"
import { nameFromTitleWrites } from "./deck-name-from-title.js"
import { isRefusal } from "./refusal.js"
import type { Author, Edit, Doom, Write } from "./doom.js"
import { onTop } from "./view-of.js"
import { type AgentFinding, agentFindings } from "./agent-findings.js"

export type AddedNode = { readonly id: NodeId; readonly change: number; readonly kind: string }
export type AgentEdit = {
  readonly edit: Edit
  readonly after: Doom
  readonly added: readonly AddedNode[]
  readonly findings: readonly AgentFinding[]
}
export type EditBy = {
  readonly author: Author
  readonly once: string
  readonly mint: () => NodeId
  readonly phase?: "start"
  readonly read?: Doom
  readonly boxes?: Reading["boxes"]
  readonly pictures?: Reading["pictures"]
  readonly measure?: Measure
  readonly componentSample?: Reading["componentSample"]
}

export function readingOf(doom: Doom, base: number): Doom {
  const at = rev(base)
  const revs = new Map<NodeId, ReadonlyMap<RevisionKey, Rev>>()
  for (const [node, props] of doom.revs)
    revs.set(node, new Map([...props].map(([key, was]) => [key, was > at ? at : was])))
  return { ...doom, revs }
}

type Bake = { readonly fold: Doom; readonly frame: NodeId }

export function compileAgentEdit(doom: Doom, changes: readonly AgentChange[], by: EditBy): AgentEdit | AgentRefusal {
  const compiled = agentEditSteps(doom, changes, by, false).next()
  if (!compiled.done) throw new Error("unexpected bake")
  return compiled.value
}

export function* agentEditSteps(
  doom: Doom,
  changes: readonly AgentChange[],
  by: EditBy,
  pauseForBake = true,
): Generator<Bake, AgentEdit | AgentRefusal, Measure> {
  if (changes.length === 0)
    return {
      refused: "shape",
      change: "changes",
      field: "changes",
      fault: "missing",
      form: "One to one hundred changes.",
    }
  const reading: Reading = {
    read: by.read ?? doom,
    ...(by.boxes === undefined ? {} : { boxes: by.boxes }),
    ...(by.pictures === undefined ? {} : { pictures: by.pictures }),
    ...(by.measure === undefined ? {} : { measure: by.measure }),
    ...(by.componentSample === undefined ? {} : { componentSample: by.componentSample }),
  }
  const writes: Write[] = []
  const ends: number[] = []
  let view = doom
  let emptied = 0
  for (const [at, change] of changes.entries()) {
    let frame: NodeId | undefined
    const beforeBake: Reading = pauseForBake
      ? {
          ...reading,
          bake: (target) => {
            frame = target
            return []
          },
        }
      : reading
    let compiled = compileAgentChange(view, change, by.mint, beforeBake)
    if (frame !== undefined && !("refused" in compiled)) {
      const measure = yield { fold: view, frame }
      compiled = compileAgentChange(view, change, by.mint, { ...reading, measure })
    }
    if ("refused" in compiled) return { ...compiled, at }
    const next = applyStep(view, {
      ...onTop(view, {
        once: `${by.once}#${at}`,
        author: by.author,
        writes: compiled,
        ...(compiled.some(({ prop }) => prop === "instance") ? { readBase: view.rev } : {}),
        ...(by.phase !== undefined && at === 0 ? { phase: by.phase } : {}),
      }),
      rev: rev(view.rev + 1),
    })
    if (isRefusal(next)) return { ...next, change: nameOf(change), at }
    if (countsOf(next).slides === 0 && countsOf(view).slides > 0) emptied = at
    view = next
    writes.push(...compiled)
    ends.push(writes.length)
  }
  const named = nameFromTitleWrites(doom, writes)
  writes.push(...named)
  const changing = changingWrites(doom, writes)
  const edit: Edit = {
    once: by.once,
    author: by.author,
    writes: changing,
    ...(changing.some(({ prop }) => prop === "instance") ? { readBase: doom.rev } : {}),
    ...(by.phase === undefined ? {} : { phase: by.phase }),
  }
  const landed = applyEdit(doom, { ...edit, rev: rev(doom.rev + 1) })
  if (isRefusal(landed) && landed.refused === "last-slide")
    return { ...landed, change: nameOf(changes[emptied] as AgentChange), at: emptied }
  if (isRefusal(landed)) {
    const refused = changing.find(
      (write) => write.node === landed.node && (landed.prop === undefined || write.prop === landed.prop),
    )
    const index = refused === undefined ? -1 : writes.indexOf(refused)
    const at = Math.max(
      0,
      ends.findIndex((end) => end > index),
    )
    return { ...landed, change: nameOf(changes[at] as AgentChange), at }
  }
  const made = writes.flatMap((write, index): AddedNode[] => {
    const node = landed.nodes.get(write.node)
    if (write.prop !== "type" || doom.nodes.has(write.node) || node === undefined) return []
    return [{ id: write.node, change: ends.findIndex((end) => end > index), kind: kindOf(node) }]
  })
  const filled = changes.flatMap((change, at): AddedNode[] => {
    const own = writes.slice(ends[at - 1] ?? 0, ends[at])
    const first = own[0]
    const node = first === undefined ? undefined : landed.nodes.get(first.node)
    if (change.op !== "add" || node === undefined || own.some((write) => write.prop === "type")) return []
    return [{ id: node.id, change: at, kind: kindOf(node) }]
  })
  const added = [...made, ...filled].sort((one, two) => one.change - two.change)
  return { edit, after: landed, added, findings: agentFindings(landed, writes) }
}
