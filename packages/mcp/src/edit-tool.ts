import { readDeckEdit, readNamedDeck } from "@airdesign/catalog"
import { doom } from "@airdesign/document"

import { answered, hostRefused, refused, doomRefused, type ToolResult } from "./answer.js"
import type { DeckHost } from "./deck-host.js"
import { imageNames, imageProblem, imagesPerCall, pictureSizes, withAssets, type NamedImages } from "./named-image.js"
import { onceIds } from "./once-ids.js"

type Read =
  | { readonly ok: true; readonly changes: readonly doom.AgentChange[] }
  | { readonly ok: false; readonly result: ToolResult }

function readChanges(raw: readonly unknown[]): Read {
  const changes: doom.AgentChange[] = []
  for (const [at, each] of raw.entries()) {
    const read = doom.readAgentChange(each)
    if ("refused" in read) {
      const op = typeof each === "object" && each !== null ? (each as { op?: unknown }).op : undefined
      return { ok: false, result: doomRefused({ ...read, change: typeof op === "string" ? op : "change", at }) }
    }
    changes.push(read)
  }
  return { ok: true, changes }
}

type Added = { readonly id: string; readonly kind: string; readonly change?: number }

function rootsOfEdit(edit: doom.Edit, added: readonly doom.AddedNode[]): readonly Added[] {
  const made = new Set<string>(added.filter((each) => each.kind !== "slideRow").map((each) => each.id))
  const parents = new Map<string, string>()
  for (const write of edit.writes)
    if (write.prop === "parent" && write.value !== null) parents.set(write.node, (write.value as { id: string }).id)
  return added.filter((each) => each.kind !== "slideRow" && !made.has(parents.get(each.id) ?? ""))
}

const makesRoot = (change: doom.AgentChange) =>
  change.op === "add" || change.op === "wrap" || (change.op === "slide" && change.add !== undefined)

function rootsInFold(fold: doom.Doom, client: string, changes: readonly doom.AgentChange[]): readonly Added[] {
  const mine = [...fold.nodes.values()].filter((node) => node.id.startsWith(`${client}:`) && node.type !== "slideRow")
  const made = new Set<string>(mine.map((node) => node.id))
  const roots = mine.filter((node) => !made.has((node as { parent?: { id: string } | null }).parent?.id ?? ""))
  const making = changes.flatMap((change, at) => (makesRoot(change) ? [at] : []))
  return roots.map((node, at) => ({
    id: node.id,
    kind: doom.agentKind(node),
    ...(making.length === roots.length ? { change: making[at] as number } : {}),
  }))
}

function landedAnswer(deck: string, rev: number, run: string, added: readonly Added[]): ToolResult {
  const words = added.map(
    (each) => `${each.id} ${each.kind}${each.change === undefined ? "" : ` (change ${String(each.change)})`}`,
  )
  const lead = `Landed at rev ${String(rev)}${added.length === 0 ? "" : `, adding ${words.join(", ")}`}. Send runId with your next edits, and to airdesign_stop_run when done.`
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
  if (before !== undefined)
    return landedAnswer(opened.deck, before, run, rootsInFold(opened.fold, ids.client, read.changes))
  const names = imageNames(read.changes)
  const found: NamedImages | undefined =
    names.length > 0 && host.images !== undefined
      ? new Map([
          ...(await host.images(parsed.deck, names.slice(0, imagesPerCall))),
          ...names.slice(imagesPerCall).map((each) => [each, { ok: false, refusal: "many" }] as const),
        ])
      : undefined
  const problem = imageProblem(read.changes, found)
  if (problem !== undefined) return problem
  const changes = found === undefined ? read.changes : withAssets(read.changes, found)
  const compiled = doom.compileAgentEdit(opened.fold, changes, {
    author: { kind: "agent", id: agent, run },
    once,
    mint: ids.mint,
    read: doom.readingOf(opened.fold, parsed.base),
    ...(found === undefined ? {} : { pictures: pictureSizes(found) }),
    ...(parsed.runId === undefined ? { phase: "start" as const } : {}),
  })
  if ("refused" in compiled) return doomRefused(compiled, { rev: opened.rev })
  const landed = await host.edit(parsed.deck, compiled.edit)
  if (!landed.ok) return hostRefused(landed)
  return landedAnswer(landed.deck, landed.rev, run, rootsOfEdit(compiled.edit, compiled.added))
}
