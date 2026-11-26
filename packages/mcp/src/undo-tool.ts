import { readNamedDeck, readRun, runUndoStays, undoStaysNote } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

import { answered, hostRefused, refused, type ToolResult } from "./answer.js"
import type { DeckHost, RunLog, UndoHost } from "./deck-host.js"
import { deckMeasure } from "./deck-measure.js"

const nothingLeft = "Unable to undo. Everything it changed was changed or deleted since."
const undoRefused = "Unable to undo. Something it changed was changed again after its edit."
const undoFailed = "Unable to undo. Check your connection and try again."
const undoTooLarge = "Unable to undo. This run made too many changes."
const undoneWord = "Undone"
const wordsShown = 40

function shown(name: string): string {
  const trimmed = name.trim()
  const words = trimmed.length <= wordsShown ? trimmed : `${trimmed.slice(0, wordsShown).trimEnd()}…`
  return `“${words}”`
}

function layerName(fold: doom.Doom, id: doom.NodeId): string {
  const node = fold.nodes.get(id)
  const name = doom.propOf(node, "name")
  if (typeof name === "string" && name.trim() !== "") return shown(name)
  const words = doom.propOf(node, "text")?.chars.split("\n")[0]?.trim() ?? ""
  return words === "" ? shown(id) : shown(words)
}

function editsOf(fold: doom.Doom, logged: RunLog): readonly doom.RunEdit[] | undefined {
  const known = new Map(fold.nodes)
  const edits: doom.RunEdit[] = []
  for (const [index, raw] of logged.edits.entries()) {
    const read = doom.readRunEdit(raw, logged.replaced[index], { ...fold, nodes: known })
    if (doom.isRefusal(read)) return undefined
    for (const write of read.writes)
      if (write.prop === "type" && !known.has(write.node))
        known.set(write.node, { id: write.node, rev: read.rev, type: write.value } as doom.Node)
    edits.push(read)
  }
  return edits
}

function positionNodes(fold: doom.Doom, edits: readonly doom.RunEdit[]): readonly doom.NodeId[] {
  const began = edits[0]!.rev
  const replaced = edits.flatMap((edit) => edit.replaced)
  const moved = new Set(replaced.filter(({ key }) => key === "parent").map(({ node }) => node))
  const mayRotate = replaced.some(({ node, key }) => {
    const stamps = fold.revs.get(node)
    return (
      key === "box" && (stamps?.get("type") ?? 0) < began && (moved.has(node) || (stamps?.get("parent") ?? 0) > began)
    )
  })
  if (!mayRotate) return []
  const nodes = new Set<doom.NodeId>()
  for (const { writes } of edits) {
    for (const { node, prop, value } of writes) {
      if (prop === "box") nodes.add(node)
      if (prop !== "parent") continue
      nodes.add(node)
      const parent = doom.props.parent.read(value)
      if (parent !== null && !doom.isRefusal(parent)) nodes.add(parent.id)
    }
  }
  return [...nodes]
}

export async function undoRunTool(raw: unknown, agent: string, once: string, host: DeckHost): Promise<ToolResult> {
  const named = readNamedDeck(raw)
  if (!named.ok) return refused(named.refusal)
  const parsed = readRun(raw)
  if (!parsed.ok) return refused(parsed.refusal)
  const result = await host.withUndo(named.deck, (locked) => turnRun(named.deck, parsed.runId, agent, once, locked))
  return "answer" in result ? result : hostRefused(result)
}

async function turnRun(
  deck: Parameters<DeckHost["open"]>[0],
  runId: string,
  agent: string,
  once: string,
  host: UndoHost,
): Promise<ToolResult> {
  const opened = await host.open(deck)
  if (!opened.ok) return hostRefused(opened)
  const run = opened.fold.runs.get(runId)
  if (run === undefined || run.agent !== agent) return refused("run-fenced", { rev: opened.rev })
  const empty = { deck: opened.deck, rev: opened.rev, runId: runId, kept: [], left: [], waiting: [] }
  if (run.undone) return answered(nothingLeft, { ok: false, reason: "nothing", ...empty })
  const logged = await host.run(opened.deck, runId)
  if (!logged.ok)
    return answered(logged.refusal === "size" ? undoTooLarge : undoFailed, {
      ok: false,
      reason: "failed",
      refusal: logged.refusal,
      ...empty,
    })
  const edits = editsOf(opened.fold, logged)
  if (edits === undefined || edits.length === 0)
    return answered(nothingLeft, { ok: false, reason: "nothing", ...empty })
  const nodes = positionNodes(opened.fold, edits)
  const started = nodes.length === 0 ? undefined : await host.positionsAt?.(opened.deck, edits[0]!.rev - 1, nodes)
  const owned = await host.undoRevs(opened.deck, agent)
  const turned = doom.invertRun(opened.fold, edits, owned, started)
  if (turned.refused !== undefined)
    return answered(undoRefused, {
      ok: false,
      reason: "refused",
      refusal: turned.refused.refused,
      ...empty,
    })
  const who = run.name === "" ? "An agent" : run.name
  const names = (ids: readonly doom.NodeId[]) => ids.map((id) => layerName(opened.fold, id))
  const { later = [] } = runUndoStays(edits, turned)
  const kept = names(turned.kept.filter((node) => !later.includes(node)))
  const note = undoStaysNote(who, {
    kept,
    later: names(later),
    left: names(turned.left),
    waiting: names(turned.waiting),
  })
  const body = {
    deck: opened.deck,
    rev: opened.rev,
    runId: runId,
    kept: turned.kept,
    left: turned.left,
    waiting: turned.waiting,
  }
  if (turned.writes.length === 0)
    return [...turned.kept, ...turned.left, ...turned.waiting].length === 0
      ? answered(nothingLeft, { ok: false, reason: "nothing", ...empty })
      : answered(note, { ok: false, reason: "left", ...body })
  const edit: doom.Edit = {
    once,
    author: { kind: "agent", id: agent, run: runId, ...(run.name === "" ? {} : { name: run.name }) },
    writes: turned.writes,
    runUndo: { run: runId, undone: true },
  }
  const lineMeasure = doom.mayLeaveDeck(opened.fold, edit.writes)
    ? await deckMeasure(host, [opened.fold, doom.viewOf(opened.fold, [edit])])
    : undefined
  const writes = doom.freeLineEnds(opened.fold, edit.writes, lineMeasure?.measure ?? doom.measureWith({}))
  const landed = await host.edit(opened.deck, { ...edit, writes })
  if (!landed.ok) {
    return answered(undoRefused, { ok: false, reason: "refused", refusal: hostRefused(landed).answer.refusal, ...body })
  }
  return answered(note === "" ? undoneWord : `${undoneWord}. ${note}`, {
    ok: true,
    ...body,
    deck: landed.deck,
    rev: landed.rev,
  })
}
