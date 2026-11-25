import * as doom from "@airdesign/doom"
import type { Notice } from "./doom-deck-types.js"
import { appliedOn, dropped, queueEdit, shown, type Queued, type Suppression } from "./doom-queue.js"

type Step = { readonly before: doom.Doom; readonly writes: readonly doom.Write[] }

export function suppressionsOf(before: doom.Doom, writes: readonly doom.Write[]): readonly Suppression[] {
  const plain = doom.partDeletes(before, writes)
  const explicit = new Map(
    writes.flatMap(({ node, prop, value }) => {
      if (prop !== "instance" || value === null) return []
      const next = doom.props.instance.read(value)
      return doom.isRefusal(next) ? [] : [[node, next.suppressed.map(({ key }) => key)]]
    }),
  )
  return [...plain, ...explicit].flatMap(([frame, keys]) => {
    const instance = doom.propOf(before.nodes.get(frame), "instance")
    const chosen = new Set(keys.map((key) => JSON.stringify(key)))
    return (
      instance?.parts.flatMap(({ node, key }) => (chosen.has(JSON.stringify(key)) ? [{ frame, node, key }] : [])) ?? []
    )
  })
}

export function suppressWrites(
  now: doom.Doom,
  writes: readonly doom.Write[],
  suppressions: readonly Suppression[],
): readonly doom.Write[] | doom.Refusal {
  const roots = new Map<doom.NodeId, doom.PartKey[]>()
  const targets = new Set<doom.NodeId>()
  for (const { frame, node, key } of suppressions) {
    const keys = roots.get(frame) ?? []
    keys.push(key)
    roots.set(frame, keys)
    targets.add(node)
  }
  const kept = writes.filter(
    ({ node, prop, value }) =>
      !(prop === "instance" && roots.has(node)) && !(prop === "parent" && value === null && targets.has(node)),
  )
  for (const [root, keys] of roots) {
    if (!doom.onDeck(now.nodes, root)) continue
    if (doom.propOf(now.nodes.get(root), "instance") === undefined) {
      for (const node of targets)
        if (
          doom.onDeck(now.nodes, node) &&
          doom.parentOf(now.nodes.get(doom.parentOf(now.nodes.get(node))?.id ?? root))?.id === root
        )
          kept.push({ node, prop: "parent", value: null })
      continue
    }
    const suppress = doom.suppressKeys(now, root, keys)
    if (doom.isRefusal(suppress)) return suppress
    kept.push(...suppress)
  }
  return kept
}

export type RunUndoSource = { readonly edits: readonly doom.RunEdit[]; readonly started?: doom.Doom }

export function undoingRun(each: Queued): string | undefined {
  return each.edit.readBase !== undefined && each.turnFrom === undefined && each.edit.runUndo?.undone === true
    ? each.edit.runUndo.run
    : undefined
}

export async function loadRunUndos(
  queue: readonly Queued[],
  once: string,
  sources: Map<string, RunUndoSource>,
  read: (run: string) => Promise<readonly doom.RunEdit[] | undefined>,
): Promise<void> {
  const affected = new Set(dropped(queue, once).gone)
  for (const each of queue) {
    const run = undoingRun(each)
    if (run === undefined || !affected.has(each.edit.once) || sources.has(run)) continue
    const edits = await read(run)
    if (edits !== undefined) sources.set(run, { edits })
  }
}

function detaches(each: Queued): boolean {
  return (
    each.turnFrom === undefined && each.edit.writes.some(({ prop, value }) => prop === "instance" && value === null)
  )
}

export function rebuilds(each: Queued): boolean {
  return (
    undoingRun(each) !== undefined ||
    each.regeneration !== undefined ||
    each.suppressions !== undefined ||
    (each.turnFrom !== undefined && each.edit.readBase !== undefined) ||
    detaches(each)
  )
}

function rebasedWrites(now: doom.Doom, each: Queued, rewritten: ReadonlySet<string>): readonly doom.Write[] {
  return each.edit.writes.map((write, index) => {
    const dependency = each.after[index]
    if (dependency == null) return write
    const { base: _base, ...asked } = write
    const base = rewritten.has(dependency) ? now.revs.get(write.node)?.get(write.prop) : now.onces.get(dependency)
    return base === undefined ? asked : { ...asked, base }
  })
}

function turnAgain(
  now: doom.Doom,
  each: Queued,
  changed: ReadonlySet<string>,
  owned: Iterable<string>,
  measure: doom.Measure,
  skipped: doom.NodeId[],
): readonly doom.Write[] | doom.Refusal {
  const names = each.turnFrom ?? []
  const source = names.at(-1)
  const at = source === undefined ? undefined : now.onces.get(source)
  const mine = new Set([...owned, ...names].flatMap((once) => now.onces.get(once) ?? []))
  if (each.turnSource !== undefined && at !== undefined) {
    const { replaced, ...sourceEdit } = each.turnSource
    const was = doom.readRunEdit({ ...sourceEdit, rev: at }, replaced, now)
    if (!doom.isRefusal(was)) {
      const removals: doom.Write[] = []
      const placed = new Set<doom.NodeId>()
      const detached = new Set(
        each.edit.writes.flatMap(({ node, prop, value }) => (prop === "instance" && value === null ? [node] : [])),
      )
      for (const { node, key, value } of was.replaced) {
        if (key !== "parent" || value !== null || !detached.has(node)) continue
        const linked = doom.props.instance.read(
          was.writes.findLast((write) => write.node === node && write.prop === "instance")?.value,
        )
        if (doom.isRefusal(linked)) continue
        for (const part of [node, linked.generated, ...linked.parts.map(({ node }) => node)]) placed.add(part)
        if (!doom.onDeck(now.nodes, node)) continue
        const removal = doom.removePlacedInstance(now, node, at, mine)
        if (removal === undefined) return { refused: "stale", node, prop: "parent" }
        removals.push(...removal)
      }
      const other = ({ node }: { readonly node: doom.NodeId }) => !placed.has(node)
      const rest = { ...was, writes: was.writes.filter(other), replaced: was.replaced.filter(other) }
      const created = new Set(rest.writes.flatMap(({ node, prop }) => (prop === "type" ? [node] : [])))
      if (created.size > 0 && rest.writes.every(({ node }) => created.has(node))) {
        const turned = doom.invertStep(doom.emptyDoom, now, rest, mine, measure)
        return doom.isRefusal(turned) ? turned : [...turned, ...removals]
      }
      const turned = doom.invertRun(now, [rest], mine, undefined, measure)
      skipped.push(...turned.skipped)
      return turned.refused ?? [...turned.writes, ...removals]
    }
  }
  if (source !== undefined && changed.has(source) && at === undefined) return []
  const writes = rebasedWrites(now, each, changed)
  const still = (write: doom.Write) => {
    const at = now.revs.get(write.node)?.get(write.prop)
    return at === undefined || mine.has(at) || at <= (write.base ?? each.edit.readBase ?? 0)
  }
  if (writes.some((write) => write.prop === "instance" && (!still(write) || !doom.onDeck(now.nodes, write.node))))
    return []
  const since = doom.rev(Math.max(0, (each.edit.readBase ?? now.rev) - (each.afterRead?.length ?? 0)))
  const measuredIn = new Map(writes.map(({ node }) => [node, doom.parentOf(now.nodes.get(node))?.id ?? null]))
  return doom.onStandingLayers(now, writes.filter(still), since, since, measuredIn)
}

function reprepare(
  now: doom.Doom,
  each: Queued,
  changed: ReadonlySet<string>,
  owned: Iterable<string>,
  measure: doom.Measure,
  runs: ReadonlyMap<string, RunUndoSource>,
  skipped: doom.NodeId[],
): readonly doom.Write[] | doom.Refusal {
  const run = undoingRun(each)
  if (run !== undefined) {
    const source = runs.get(run)
    if (source === undefined || now.runs.get(run)?.undone !== false) return []
    const mine = new Set([...owned].flatMap((once) => now.onces.get(once) ?? []))
    const turned = doom.invertRun(now, source.edits, mine, source.started, measure)
    skipped.push(...turned.skipped)
    return turned.refused ?? turned.writes
  }
  const intent = each.regeneration
  if (intent !== undefined) {
    const stored = doom.props.instance.read(
      each.edit.writes.find(({ node, prop }) => node === intent.frame && prop === "instance")?.value,
    )
    if (doom.isRefusal(stored)) return stored
    const patch = Object.fromEntries(intent.fields.map((field) => [field, stored[field]]))
    const made = doom.regenerateComponent(now, intent.frame, patch, measure)
    return doom.isRefusal(made) ? made : made.writes
  }
  if (each.turnFrom !== undefined) return turnAgain(now, each, changed, owned, measure, skipped)
  const writes = rebasedWrites(now, each, changed)
  if (each.suppressions !== undefined) return suppressWrites(now, writes, each.suppressions)
  if (detaches(each))
    return writes.filter(
      ({ node, prop, value }) =>
        prop !== "instance" ||
        value !== null ||
        (doom.onDeck(now.nodes, node) && doom.propOf(now.nodes.get(node), "instance") !== undefined),
    )
  return writes
}

export function replayLinked(
  server: doom.Doom,
  queued: readonly Queued[],
  affected: readonly string[],
  measure: doom.Measure,
  owned: Iterable<string>,
  runs: ReadonlyMap<string, RunUndoSource>,
  turnOf: (once: string) => "undo" | "redo" | undefined = () => undefined,
) {
  const names = new Set(affected)
  const changed = new Set<string>()
  const queue: Queued[] = []
  const gone: string[] = []
  const steps = new Map<string, Step>()
  const notices: Notice[] = []
  for (const each of queued) {
    const { once, readBase, ...edit } = each.edit
    if (!names.has(once)) {
      queue.push(each)
      continue
    }
    changed.add(once)
    const before = shown(server, queue)
    const original = each.turnFrom?.at(-1)
    const source = original === undefined ? undefined : steps.get(original)
    const turnSource = each.turnSource
    const rebuiltSource =
      source === undefined || turnSource === undefined
        ? each
        : {
            ...each,
            turnSource: doom.undoSourceOf(source.before, {
              ...turnSource,
              writes: source.writes,
              rev: before.onces.get(turnSource.once) ?? turnSource.rev,
            }),
          }
    const skipped: doom.NodeId[] = []
    const fresh = reprepare(before, rebuiltSource, changed, owned, measure, runs, skipped)
    const turn = turnOf(once)
    for (const node of skipped)
      notices.push({ once, refused: "missing", node, prop: "spec", ...(turn === undefined ? {} : { turn }) })
    if (doom.isRefusal(fresh) || fresh.length === 0 || (readBase !== undefined && !rebuilds(each))) {
      gone.push(once)
      if (doom.isRefusal(fresh) && fresh.refused !== "missing") notices.push({ once, ...fresh })
      if (readBase !== undefined && !rebuilds(each)) notices.push({ once, refused: "stale", because: affected[0]! })
      continue
    }
    const writes = doom.freeLineEnds(before, fresh, measure)
    const made = queueEdit(server, queue, {
      ...edit,
      once,
      writes,
      ...(readBase === undefined ? {} : { readBase: before.rev }),
    })
    const trial = doom.isRefusal(made) ? made : appliedOn(before, made.edit)
    if (
      readBase === before.rev &&
      !doom.isRefusal(made) &&
      JSON.stringify(made.edit.writes) === JSON.stringify(each.edit.writes) &&
      JSON.stringify(made.afterRead) === JSON.stringify(each.afterRead) &&
      JSON.stringify(made.after) === JSON.stringify(each.after)
    ) {
      gone.push(once)
      if (each.follows === undefined) notices.push({ once, refused: "stale" })
      continue
    }
    if (doom.isRefusal(made) || doom.isRefusal(trial)) {
      gone.push(once)
      if (doom.isRefusal(trial) && !["missing", "stale"].includes(trial.refused)) notices.push({ once, ...trial })
      continue
    }
    queue.push({ ...rebuiltSource, ...made })
    const step = { before, writes }
    steps.set(once, step)
  }
  return { queue, gone, steps, notices }
}

export function dropNotices(
  queue: readonly Queued[],
  gone: readonly string[],
  once: string,
  refusal: Omit<Notice, "once">,
): readonly Notice[] {
  const dropped = new Set(gone)
  return queue.flatMap((each) => {
    const name = each.edit.once
    if (!dropped.has(name) || each.follows !== undefined) return []
    return [{ once: name, ...(name === once ? refusal : { refused: "stale" as const, because: once }) }]
  })
}
