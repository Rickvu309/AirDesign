import type {Id} from "../../../deck/src/model.ts"
import type {Contribution, History, CommandId} from "../index.ts"

import {contributionProperties} from "../history-properties.ts"

export type PropertyHead = {node: Id; key: string; event: CommandId; seq: number; active: boolean; actor: Contribution["actor"]}
export type KeyHead = {node: Id; key: string; latest: CommandId; person: CommandId | null}
export type HistoryHeads = {properties: PropertyHead[]; keys: KeyHead[]}
export function rebuildHistoryHeads(history: Pick<History, "events">): HistoryHeads {
  const properties: PropertyHead[] = [], keys = new Map<string, KeyHead>()
  const updates = new Map<number, Contribution[]>()
  for (const event of history.events) {
    for (const {node,key} of contributionProperties(event)) properties.push({node, key, event: event.id, seq: event.seq, active: event.active, actor: event.actor})
    for (const seq of new Set([event.seq, event.toggledAt])) {
      const batch = updates.get(seq) ?? []; batch.push(event); updates.set(seq, batch)
    }
  }
  for (const [, batch] of [...updates].sort(([a],[b]) => a-b)) for (const event of batch.sort((a,b) => a.seq-b.seq)) for (const {node,key} of contributionProperties(event)) {
    const identity = JSON.stringify([node,key]), old = keys.get(identity)
    keys.set(identity, {node, key, latest: event.id, person: event.actor === "person" ? event.id : old?.person ?? null})
  }
  return {properties, keys: [...keys.values()]}
}
