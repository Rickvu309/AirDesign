import { compileAdd } from "./agent-add.js"
import { compileDelete, compileMove, compileUnwrap, compileWrap } from "./agent-arrange.js"
import { compileSet } from "./agent-set.js"
import { compileSlide } from "./agent-slide.js"
import { compileDeck, compileDuplicate, compilePaste } from "./agent-copy.js"
import type { AgentChange, AgentRefusal } from "./agent-change.js"
import { detachComponent } from "./component/join-instance.js"
import { type Reading, Stop, draftOf, living, stop } from "./agent-draft.js"
import { readNodeId, type NodeId } from "./ids.js"
import type { Write } from "./doom.js"
import type { Doom } from "./doom.js"
import { freeLineEnds } from "./freed-line-ends.js"
import { measureWith } from "./measure.js"
import { prepareComponentEdit, recordingMeasure, sampleComponentEdit } from "./component/component-edit.js"
import { prepareComponentSpec } from "./component/component-write.js"
import { isRefusal } from "./refusal.js"
import { propOf } from "./doom-walk.js"

const estimate = measureWith({})

export function nameOf(change: AgentChange): string {
  switch (change.op) {
    case "add":
      return `add ${change.kind}`
    case "set":
    case "detach":
      return `${change.op} ${change.target}`
    case "move": {
      const ids = change.nodes ?? (change.node === undefined ? [] : [change.node])
      return `move ${ids[0] ?? ""}${ids.length > 1 ? `+${ids.length - 1}` : ""}`
    }
    case "unwrap":
      return `${change.op} ${change.node}`
    case "wrap":
    case "delete":
    case "duplicate":
      return `${change.op} ${change.nodes[0] ?? ""}${change.nodes.length > 1 ? `+${change.nodes.length - 1}` : ""}`
    case "slide":
      return `slide ${change.add !== undefined ? "add" : change.move !== undefined ? "move" : change.delete !== undefined ? "delete" : ""}`.trim()
    case "paste":
      return `paste ${change.piece.name ?? change.piece.type}`
    case "deck":
      return "deck"
    case "component":
      return change.target === undefined ? "component" : `component ${change.target}`
  }
}

type ComponentChange = Extract<AgentChange, { readonly op: "component" }>

function compileComponent(
  doom: Doom,
  change: ComponentChange,
  mint: () => NodeId,
  reading: Reading,
): readonly Write[] | AgentRefusal {
  const recorder = reading.componentSample === undefined ? undefined : recordingMeasure()
  const measure = recorder?.measure ?? reading.measure ?? estimate
  const made = prepareComponentSpec(doom, change, measure, mint)
  if (recorder !== undefined) reading.componentSample?.(recorder.sample(doom))
  return isRefusal(made) ? { ...made, change: nameOf(change) } : made.writes
}

export function compileAgentChange(
  doom: Doom,
  change: AgentChange,
  mint: () => NodeId,
  reading: Reading = {},
): readonly Write[] | AgentRefusal {
  if (change.op === "component") return compileComponent(doom, change, mint, reading)
  const draft = draftOf(doom, mint, reading)
  try {
    const focus = change.op === "set" ? change.focus : undefined
    const focusEdit =
      focus !== undefined && change.op === "set"
        ? { node: readNodeId(change.target) ?? stop("shape", undefined, "focus", "needs", "a linked component"), focus }
        : undefined
    if (focusEdit !== undefined && propOf(doom.nodes.get(focusEdit.node), "instance") === undefined)
      stop("shape", focusEdit.node, "focus", "needs", "a linked component")
    if (change.op === "add") compileAdd(draft, change)
    if (change.op === "set") compileSet(draft, change)
    if (change.op === "detach") {
      const target = living(draft, change.target, "target")
      if (propOf(target, "instance") === undefined)
        stop(
          "shape",
          target.id,
          "target",
          undefined,
          "This layer is not a linked template. Read the deck for a linked template id.",
        )
      const detached = detachComponent(doom, change.target)
      if (isRefusal(detached)) throw new Stop(detached)
      draft.writes.push(...detached)
    }
    if (change.op === "move") compileMove(draft, change)
    if (change.op === "wrap") compileWrap(draft, change)
    if (change.op === "unwrap") compileUnwrap(draft, change)
    if (change.op === "duplicate") compileDuplicate(draft, change)
    if (change.op === "paste") compilePaste(draft, change)
    if (change.op === "deck") compileDeck(draft, change)
    if (change.op === "delete") compileDelete(draft, change)
    if (change.op === "slide") compileSlide(draft, change)
    if (reading.componentSample !== undefined) {
      const sample = sampleComponentEdit(doom, draft.writes, reading.batchStart, focusEdit)
      if (isRefusal(sample)) return { ...sample, change: nameOf(change) }
      if (sample !== null) reading.componentSample(sample)
    }
    const measure = reading.measure ?? estimate
    const writes = prepareComponentEdit(doom, draft.writes, measure, reading.batchStart, focusEdit)
    return isRefusal(writes) ? { ...writes, change: nameOf(change) } : freeLineEnds(doom, writes, measure)
  } catch (thrown) {
    if (thrown instanceof Stop) return { ...thrown.refusal, change: nameOf(change) }
    throw thrown
  }
}
