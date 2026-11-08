import {createHash} from "node:crypto"
import {isDeepStrictEqual} from "node:util"
import {parseDeck, type Deck, type Element, type Id} from "../../../deck/src/index.ts"
import {decodeLegacyRunsV2} from "../../../deck/src/text/legacy-v2.ts"
import {parseNativeArchiveV3, type NativeDeck, type NativeElement} from "../../../deck/src/text/native-v3.ts"
import type {NativeChangeSet} from "../../../deck/src/text/operations.ts"
import {decodeLegacyCommandV2} from "../command-codec.ts"
import {execute, executeWithModel, initialHistory, nodes, projectHistory, type Command, type CommandId, type Contribution, type ExecutionIdentity, type History, type Patch} from "../index.ts"
import {rebuildHistoryHeads, type HistoryHeads} from "./history-heads.ts"
import {allocateTextLifetimeIds, type TextLifetimeAllocation, type TextLifetimeInput} from "./migration-ids.ts"
import {initialNativeHistory, nativeHistoryModel, nativeNodes} from "./native-model.ts"

export type ArchivedEventV2 = {seq: number; commandBytes: string; receiptBytes: string; identity: ExecutionIdentity}
export type ArchivedReceiptV2 = {id: CommandId; payload: string; receiptBytes: string}
export type ImmutableLegacyArchiveV2 = {version: 2; events: ArchivedEventV2[]; receipts: ArchivedReceiptV2[]}
export type LegacyHistoryArchiveV2 = {version: 2; history: History; immutable: ImmutableLegacyArchiveV2}
export type ParagraphHistoryArchiveV3 = {version: 3; history: History<NativeDeck>; immutable: ImmutableLegacyArchiveV2; lifetimes: TextLifetimeAllocation[]; heads: HistoryHeads; prefixes: {seq: number; digest: string}[]}
function equal(actual: unknown, expected: unknown, code: string) { if (!isDeepStrictEqual(actual, expected)) throw new Error(code) }
function comparableLegacyHistory(history: History) {
  return {...history, runs: [...history.runs].sort((a,b) => a.id.localeCompare(b.id)), usedIds: undefined, events: history.events.map(event => ({...event, patches: event.patches.map(patch => {
    if (new Set(patch.keys).size !== patch.keys.length) throw new Error("duplicate-history-property")
    return {...patch, keys: [...patch.keys].sort()}
  })}))}
}
function originKey(value: TextLifetimeInput): string { return JSON.stringify([value.deck,value.element,value.lifetime]) }
function textElements(deck: Deck): Extract<Element, {kind: "text"}>[] {
  function visit(elements: Element[]): Extract<Element, {kind: "text"}>[] { return elements.flatMap(element => element.kind === "text" ? [element] : element.kind === "group" ? visit(element.children) : []) }
  return deck.slides.flatMap(slide => visit(slide.elements))
}
function validateImmutable(archive: ImmutableLegacyArchiveV2) {
  if (archive.version !== 2) throw new Error("unsupported-immutable-archive-version")
  const receipts = new Map<CommandId, unknown>(), applied = new Set<CommandId>()
  for (const row of archive.receipts) {
    if (receipts.has(row.id) || typeof row.payload !== "string") throw new Error("invalid-archived-receipt")
    const receipt: unknown = JSON.parse(row.receiptBytes)
    if (!receipt || typeof receipt !== "object" || !("id" in receipt) || receipt.id !== row.id || !("seq" in receipt) || !Number.isSafeInteger(receipt.seq) || Number(receipt.seq) < 0 || !("kind" in receipt)) throw new Error("invalid-archived-receipt")
    if (receipt.kind === "applied") applied.add(row.id)
    else if (receipt.kind !== "refused" || !("code" in receipt) || typeof receipt.code !== "string" || !("command" in receipt) || decodeLegacyCommandV2({version: 2, command: receipt.command}).id !== row.id) throw new Error("invalid-archived-receipt")
    receipts.set(row.id, receipt)
  }
  const events = new Set<CommandId>()
  for (const row of archive.events) {
    const command = decodeLegacyCommandV2({version: 2, command: JSON.parse(row.commandBytes)})
    if (events.has(command.id) || !applied.has(command.id)) throw new Error("invalid-archived-event")
    equal(receipts.get(command.id), JSON.parse(row.receiptBytes), "archived-event-receipt-mismatch")
    events.add(command.id)
  }
  if (events.size !== applied.size) throw new Error("missing-archived-event")
}
function admittedArchivedRun<D>(history: History<D>, row: ArchivedEventV2, runs: History["runs"]): History<D> {
  if (row.identity.kind !== "run") return history
  const run = row.identity.run
  if (history.runs.some(value => value.id === run)) return history
  const saved = runs.find(value => value.id === run)
  if (!saved || saved.epoch !== history.seq) throw new Error("invalid-archived-run-admission")
  return {...history, runs: [...history.runs, {id: saved.id, epoch: saved.epoch, kind: "open"}]}
}
function decodeEvent(row: ArchivedEventV2, current: History, runs: History["runs"]) {
  if (row.seq !== current.seq + 1) throw new Error("legacy-event-sequence-gap")
  const command = decodeLegacyCommandV2({version: 2, command: JSON.parse(row.commandBytes)})
  const result = execute(admittedArchivedRun(current, row, runs), command, row.identity)
  if (result.receipt.kind !== "applied") throw new Error("legacy-event-replay-refused")
  equal(result.receipt, JSON.parse(row.receiptBytes), "legacy-event-receipt-mismatch")
  return {command, history: result.history}
}
function convertDeck(deck: Deck, lifetime: (element: Id) => TextLifetimeAllocation): NativeDeck {
  function element(value: Element): NativeElement {
    if (value.kind === "group") return {...value, children: value.children.map(element)}
    if (value.kind !== "text") return value
    const allocation = lifetime(value.id), {runs, ...base} = value
    return {...base, body: decodeLegacyRunsV2(runs, allocation.frame, allocation.paragraph)}
  }
  return parseNativeArchiveV3({version: 3, deck: {...deck, slides: deck.slides.map(slide => ({...slide, elements: slide.elements.map(element)}))}}).deck
}
function reconcileAdoption(delta: Patch[], before: NativeDeck, after: NativeDeck, event: Contribution): Patch[] {
  const previous = new Map(nativeNodes(before).map(node => [node.id,node])), next = new Map(nativeNodes(after).map(node => [node.id,node]))
  const legacy = new Map(event.patches.map(patch => [patch.id,patch]))
  const result = delta.map(patch => {
    const node = patch.after ?? patch.before
    const source = legacy.get(node && (node.fields.kind === "paragraph" || node.fields.kind === "text-frame") && node.parent ? node.parent : patch.id)
    return {...patch, adopts: source?.adopts ?? false, places: source?.places ?? false}
  })
  for (const patch of event.patches) if (patch.adopts && patch.after?.fields.kind === "text") {
    for (const node of next.values()) if (node.id === patch.id || node.parent === patch.id) {
      const existing = result.find(patch => patch.id === node.id)
      if (existing) existing.adopts = true
      else result.push({id: node.id, before: previous.get(node.id) ?? null, after: node, keys: [], adopts: true, places: false})
    }
  }
  return result
}
function proof(history: History<NativeDeck>): {seq: number; digest: string} {
  return {seq: history.seq, digest: createHash("sha256").update(JSON.stringify({history, heads: rebuildHistoryHeads(history)})).digest("hex")}
}
function validateNative(archive: ParagraphHistoryArchiveV3): ParagraphHistoryArchiveV3 {
  validateImmutable(archive.immutable)
  parseNativeArchiveV3({version: 3, deck: archive.history.initial})
  parseNativeArchiveV3({version: 3, deck: archive.history.deck})
  if (archive.immutable.version !== 2 || new Set(archive.history.usedIds).size !== archive.history.usedIds.length) throw new Error("invalid-native-history-reservations")
  for (const event of archive.history.events) for (const patch of event.patches) for (const node of [patch.before,patch.after]) if (node) {
    if (!archive.history.usedIds.includes(node.id) || node.fields.kind === "text" && ("runs" in node.fields || "body" in node.fields)) throw new Error("invalid-native-history-node")
  }
  for (const allocation of archive.lifetimes) if (!archive.history.usedIds.includes(allocation.frame) || !archive.history.usedIds.includes(allocation.paragraph)) throw new Error("missing-native-lifetime-reservation")
  equal(projectHistory(archive.history, nativeHistoryModel), archive.history.deck, "native-final-projection-mismatch")
  equal(rebuildHistoryHeads(archive.history), archive.heads, "native-heads-mismatch")
  equal(archive.prefixes.at(-1), proof(archive.history), "native-prefix-proof-mismatch")
  return structuredClone(archive)
}
export function transduceLegacyHistory(archive: LegacyHistoryArchiveV2 | ParagraphHistoryArchiveV3): ParagraphHistoryArchiveV3 {
  if (archive.version === 3) return validateNative(archive)
  if (archive.version !== 2 || archive.immutable.version !== 2) throw new Error("unsupported-history-archive-version")
  validateImmutable(archive.immutable)
  parseDeck(archive.history.initial); parseDeck(archive.history.deck)
  const inputs: TextLifetimeInput[] = textElements(archive.history.initial).map(element => ({deck: archive.history.initial.id, element: element.id, lifetime: {kind: "initial"}}))
  let legacy = initialHistory(archive.history.initial)
  const reserved = new Set<Id>(archive.history.usedIds)
  for (const node of nodes(archive.history.initial)) reserved.add(node.id)
  for (const row of archive.immutable.events) {
    legacy = decodeEvent(row, legacy, archive.history.runs).history
    const event = legacy.events.find(event => event.seq === row.seq)
    for (const patch of event?.patches ?? []) {
      for (const node of [patch.before,patch.after]) if (node) reserved.add(node.id)
      if (patch.after?.fields.kind === "text" && patch.before?.fields.kind !== "text") inputs.push({deck: legacy.deck.id, element: patch.id, lifetime: {kind: "contribution", command: event?.id ?? ""}})
    }
  }
  equal(comparableLegacyHistory(legacy), comparableLegacyHistory(archive.history), "legacy-persisted-history-mismatch")
  if (new Set(archive.history.usedIds).size !== archive.history.usedIds.length || legacy.usedIds.some(id => !archive.history.usedIds.includes(id))) throw new Error("invalid-legacy-used-ids")
  const lifetimes = allocateTextLifetimeIds(inputs, [...reserved]), byOrigin = new Map(lifetimes.map(value => [originKey(value),value])), byFrame = new Map(lifetimes.map(value => [value.frame,value]))
  function allocation(element: Id, command?: CommandId): TextLifetimeAllocation {
    const found = byOrigin.get(originKey({deck: legacy.deck.id, element, lifetime: command ? {kind: "contribution", command} : {kind: "initial"}}))
    if (!found) throw new Error("missing-text-lifetime")
    return found
  }
  let native = initialNativeHistory(convertDeck(archive.history.initial, element => allocation(element)))
  const introduced = new Set(legacy.usedIds)
  native.usedIds.push(...archive.history.usedIds.filter(id => !introduced.has(id) && !native.usedIds.includes(id)))
  legacy = initialHistory(archive.history.initial)
  const prefixes = [proof(native)]
  for (const row of archive.immutable.events) {
    const step = decodeEvent(row, legacy, archive.history.runs), source = step.history.events.find(event => event.seq === row.seq)
    let command: Command<NativeChangeSet>
    if (step.command.kind === "edit" || step.command.kind === "patch") {
      const current = nativeNodes(native.deck)
      const desired = convertDeck(step.history.deck, element => {
        const frame = current.find(node => node.parent === element && node.fields.kind === "text-frame")
        const found = frame && byFrame.get(frame.id)
        return found ?? allocation(element, step.command.id)
      })
      command = {id: step.command.id, kind: "edit", base: step.command.base, run: step.command.run, changes: nativeHistoryModel.replace(desired)}
    } else command = step.command
    const model = source ? {...nativeHistoryModel, staleConflicts: "runs" as const, reconcileDelta: (delta: Patch[], before: NativeDeck, after: NativeDeck) => reconcileAdoption(delta,before,after,source)} : nativeHistoryModel
    native = admittedArchivedRun(native, row, archive.history.runs)
    const result = executeWithModel(native, command, model, row.identity)
    if (result.receipt.kind !== "applied") throw new Error(`native-event-replay-refused:${row.seq}:${result.receipt.code}`)
    equal(result.receipt, JSON.parse(row.receiptBytes), "native-receipt-mismatch")
    native = result.history
    native.deck.slides = native.deck.slides.map(slide => ({...slide, version: step.history.deck.slides.find(current => current.id === slide.id)?.version ?? slide.version}))
    const current = nativeNodes(native.deck)
    const expected = convertDeck(step.history.deck, element => {
      const frame = current.find(node => node.parent === element && node.fields.kind === "text-frame"), found = frame && byFrame.get(frame.id)
      if (!found) throw new Error("native-prefix-lifetime-missing")
      return found
    })
    equal(native.deck, expected, `native-prefix-deck-mismatch:${row.seq}`)
    equal(projectHistory(native, nativeHistoryModel), native.deck, `native-prefix-projection-mismatch:${row.seq}`)
    prefixes.push(proof(native)); legacy = step.history
  }
  native.runs = structuredClone(archive.history.runs)
  native.usedIds = [...archive.history.usedIds, ...lifetimes.flatMap(value => [value.frame,value.paragraph])]
  prefixes[prefixes.length-1] = proof(native)
  return validateNative({version: 3, history: native, immutable: structuredClone(archive.immutable), lifetimes, heads: rebuildHistoryHeads(native), prefixes})
}
export function archivedLegacyRetry(archive: ParagraphHistoryArchiveV3, id: CommandId, payload: string): {kind: "miss"} | {kind: "hit"; receiptBytes: string} {
  const row = archive.immutable.receipts.find(row => row.id === id)
  if (!row) return {kind: "miss"}
  if (row.payload !== payload) throw new Error("request-id-payload-mismatch")
  return {kind: "hit", receiptBytes: row.receiptBytes}
}
