import { readDeckEdit, readNamedDeck } from "@airdesign/catalog"
import { scene } from "@airdesign/document"

import { answered, hostRefused, refused, sceneRefused, type ToolResult } from "./answer.js"
import type { DeckHost } from "./deck-host.js"
import { imageAddresses, imageProblem, imagesPerCall, withAssets, type NamedImages } from "./named-image.js"
import { onceIds } from "./once-ids.js"

type Read =
  | { readonly ok: true; readonly changes: readonly scene.AgentChange[] }
  | { readonly ok: false; readonly result: ToolResult }

function readChanges(raw: readonly unknown[]): Read {
  const changes: scene.AgentChange[] = []
  for (const [at, each] of raw.entries()) {
    const read = scene.readAgentChange(each)
    if ("refused" in read) {
      const op = typeof each === "object" && each !== null ? (each as { op?: unknown }).op : undefined
      return { ok: false, result: sceneRefused({ ...read, change: typeof op === "string" ? op : "change", at }) }
    }
    changes.push(read)
  }
  return { ok: true, changes }
}

function rootsInFold(fold: scene.Scene, client: string): readonly scene.NodeId[] {
  const mine = [...fold.nodes.keys()].filter((id) => id.startsWith(`${client}:`))
  const made = new Set<string>(mine)
  return mine.filter((id) => !made.has((fold.nodes.get(id) as { parent?: { id: string } | null }).parent?.id ?? ""))
}

function rootsOfEdit(edit: scene.Edit, added: readonly scene.NodeId[]): readonly scene.NodeId[] {
  const made = new Set<string>(added)
  const parents = new Map<string, string>()
  for (const write of edit.writes)
    if (write.prop === "parent" && write.value !== null) parents.set(write.node, (write.value as { id: string }).id)
  return added.filter((id) => !made.has(parents.get(id) ?? ""))
}

function landedAnswer(deck: string, rev: number, run: string, added: readonly string[]): ToolResult {
  const lead = `Landed at rev ${String(rev)}${added.length === 0 ? "" : `, adding ${added.join(", ")}`}. Send runId with your next edits, and to airdesign_stop_run when done.`
  return answered(lead, { ok: true, deck, rev, runId: run, added })
}

export async function editDeckTool(raw: unknown, agent: string, once: string, host: DeckHost): Promise<ToolResult> {
  const named = readNamedDeck(raw)
  if (!named.ok) return refused(named.refusal)
  const opened = await host.open(named.deck)
  if (!opened.ok) return hostRefused(opened)
  const parsed = readDeckEdit(raw)
  if (!parsed.ok) return refused(parsed.refusal)
  const read = readChanges(parsed.changes)
  if (!read.ok) return read.result
  if (parsed.base > opened.rev) return refused("base", { rev: opened.rev })
  const ids = onceIds(once)
  const run = parsed.runId ?? ids.run
  const before = opened.fold.onces.get(once)
  if (before !== undefined) return landedAnswer(opened.deck, before, run, rootsInFold(opened.fold, ids.client))
  const addresses = imageAddresses(read.changes)
  let changes = read.changes
  if (addresses.length > 0 && host.images !== undefined) {
    const found: NamedImages = new Map([
      ...(await host.images(parsed.deck, addresses.slice(0, imagesPerCall))),
      ...addresses.slice(imagesPerCall).map((each) => [each, { ok: false, refusal: "many" }] as const),
    ])
    const problem = imageProblem(changes, found)
    if (problem !== undefined) return problem
    changes = withAssets(changes, found)
  }
  const compiled = scene.compileAgentEdit(opened.fold, changes, {
    author: { kind: "agent", id: agent, run },
    once,
    mint: ids.mint,
    read: scene.readingOf(opened.fold, parsed.base),
    ...(parsed.runId === undefined ? { phase: "start" as const } : {}),
  })
  if ("refused" in compiled) return sceneRefused(compiled, { rev: opened.rev })
  const landed = await host.edit(parsed.deck, compiled.edit)
  if (!landed.ok) return hostRefused(landed)
  return landedAnswer(landed.deck, landed.rev, run, rootsOfEdit(compiled.edit, compiled.added))
}
