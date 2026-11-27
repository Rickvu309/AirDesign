import type { Intent, IntentRefusal } from "./intent-read.js"
import { compileIntent, nameOf } from "./intent-compile.js"
import type { Reading } from "./intent-draft.js"
import type { Measure } from "./measure.js"
import type { PlacementRules } from "./placement-rules.js"
import type { StartRules } from "./start-rules.js"
import type { NodeId } from "./ids.js"
import { rev } from "./ids.js"
import { kindOf } from "./layer-kind.js"
import { applyStep, countsOf } from "./apply-edit.js"
import { changingWrites } from "./changing-writes.js"
import { land } from "./land.js"
import { measureWith } from "./measure.js"
import { isRefusal } from "./refusal.js"
import type { Author, Edit, Doom, Write } from "./doom.js"
import { onTop } from "./view-of.js"
import { type ThemeProblem, themeProblems } from "./theme-problems.js"

export type AddedNode = { readonly id: NodeId; readonly change: number; readonly kind: string }
export type IntentEdit = {
  readonly edit: Edit
  readonly after: Doom
  readonly added: readonly AddedNode[]
  readonly problems: readonly ThemeProblem[]
}
export type EditBy = {
  readonly author: Author
  readonly once: string
  readonly mint: () => NodeId
  readonly placement: PlacementRules
  readonly starts: StartRules
  readonly phase?: "start"
  readonly read?: Doom
  readonly boxes?: Reading["boxes"]
  readonly pictures?: Reading["pictures"]
  readonly measure?: Measure
}

export type Bake = { readonly fold: Doom; readonly frame: NodeId }

const estimate = measureWith({})

export function compileIntents(doom: Doom, intents: readonly Intent[], by: EditBy): IntentEdit | IntentRefusal {
  const compiled = intentSteps(doom, intents, by, false).next()
  if (!compiled.done) throw new Error("unexpected bake")
  return compiled.value
}

export type IntentStep = { readonly view: Doom; readonly added: readonly NodeId[] }

export type IntentSession = {
  readonly view: () => Doom
  readonly step: (
    intent: Intent,
    pauseForBake?: boolean,
    measure?: Measure,
  ) => Generator<Bake, IntentStep | IntentRefusal, Measure>
  readonly finish: (measure?: Measure) => IntentEdit | IntentRefusal
}

export function intentSession(doom: Doom, by: EditBy): IntentSession {
  const reading: Reading = {
    read: by.read ?? doom,
    ...(by.boxes === undefined ? {} : { boxes: by.boxes }),
    ...(by.pictures === undefined ? {} : { pictures: by.pictures }),
    ...(by.measure === undefined ? {} : { measure: by.measure }),
  }
  const intents: Intent[] = []
  const writes: Write[] = []
  const ends: number[] = []
  let view = doom
  let emptied = 0
  function* step(
    intent: Intent,
    pauseForBake = true,
    measure?: Measure,
  ): Generator<Bake, IntentStep | IntentRefusal, Measure> {
    const at = intents.length
    const stepReading = measure === undefined ? reading : { ...reading, measure }
    let frame: NodeId | undefined
    const beforeBake: Reading = pauseForBake
      ? {
          ...stepReading,
          bake: (target) => {
            frame = target
            return []
          },
        }
      : stepReading
    let compiled = compileIntent(view, intent, by.mint, by.placement, by.starts, beforeBake)
    if (frame !== undefined && !("refused" in compiled)) {
      const baked = yield { fold: view, frame }
      compiled = compileIntent(view, intent, by.mint, by.placement, by.starts, { ...stepReading, measure: baked })
    }
    if ("refused" in compiled) return { ...compiled, at }
    const next = applyStep(view, {
      ...onTop(view, {
        once: `${by.once}#${at}`,
        author: by.author,
        writes: compiled,
        ...(by.phase !== undefined && at === 0 ? { phase: by.phase } : {}),
      }),
      rev: rev(view.rev + 1),
    })
    if (isRefusal(next)) return { ...next, change: nameOf(intent), at }
    if (countsOf(next).slides === 0 && countsOf(view).slides > 0) emptied = at
    const before = view
    view = next
    intents.push(intent)
    writes.push(...compiled)
    ends.push(writes.length)
    const added = compiled.flatMap((write) =>
      write.prop === "type" && !before.nodes.has(write.node) ? [write.node] : [],
    )
    const filled = intent.op === "insert" && added.length === 0 ? compiled[0]?.node : undefined
    return { view, added: filled === undefined ? [...new Set(added)] : [filled] }
  }
  function finish(measure: Measure = by.measure ?? estimate): IntentEdit | IntentRefusal {
    if (intents.length === 0)
      return {
        refused: "shape",
        change: "changes",
        field: "changes",
        fault: "missing",
        expect: { code: "batch" },
      }
    const landing = land(doom, writes, {
      author: by.author,
      once: by.once,
      measure,
      starts: by.starts,
      ...(by.phase === undefined ? {} : { phase: by.phase }),
    })
    if (isRefusal(landing) && landing.refused === "last-slide")
      return { ...landing, change: nameOf(intents[emptied] as Intent), at: emptied }
    if (isRefusal(landing)) {
      const refused = changingWrites(doom, writes).find(
        (write) => write.node === landing.node && (landing.prop === undefined || write.prop === landing.prop),
      )
      const index = refused === undefined ? -1 : writes.indexOf(refused)
      const at = Math.max(
        0,
        ends.findIndex((end) => end > index),
      )
      return { ...landing, change: nameOf(intents[at] as Intent), at }
    }
    const { edit, after: landed } = landing
    const all = [...writes, ...landing.named]
    const made = all.flatMap((write, index): AddedNode[] => {
      const node = landed.nodes.get(write.node)
      if (write.prop !== "type" || doom.nodes.has(write.node) || node === undefined) return []
      return [{ id: write.node, change: ends.findIndex((end) => end > index), kind: kindOf(node) }]
    })
    const filled = intents.flatMap((intent, at): AddedNode[] => {
      const own = all.slice(ends[at - 1] ?? 0, ends[at])
      const first = own[0]
      const node = first === undefined ? undefined : landed.nodes.get(first.node)
      if (intent.op !== "insert" || node === undefined || own.some((write) => write.prop === "type")) return []
      return [{ id: node.id, change: at, kind: kindOf(node) }]
    })
    const added = [...made, ...filled].sort((one, two) => one.change - two.change)
    return { edit, after: landed, added, problems: themeProblems(landed, all) }
  }
  return { view: () => view, step, finish }
}

export function* intentSteps(
  doom: Doom,
  intents: readonly Intent[],
  by: EditBy,
  pauseForBake = true,
): Generator<Bake, IntentEdit | IntentRefusal, Measure> {
  const session = intentSession(doom, by)
  for (const intent of intents) {
    const stepped = yield* session.step(intent, pauseForBake)
    if ("refused" in stepped) return stepped
  }
  return session.finish()
}
