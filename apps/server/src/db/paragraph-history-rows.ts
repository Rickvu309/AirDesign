import type {CatalogSql} from "../../../../packages/catalog/src/index.ts"
import {commandId, type Contribution, type History, type RunState, type ExecutionIdentity} from "../../../../packages/change-log/src/index.ts"
import {decodeLegacyCommandV2} from "../../../../packages/change-log/src/command-codec.ts"
import type {LegacyHistoryArchiveV2} from "../../../../packages/change-log/src/text/history-transducer.ts"

export async function completeHistory<D>(tx: CatalogSql, deck: string, state: History<D>): Promise<History<D>> {
  const events = await tx.query<{payload: Contribution}>("SELECT payload FROM editing_contribution WHERE deck=$1 ORDER BY (payload->>'seq')::integer", [deck])
  const runs = await tx.query<{payload: RunState}>("SELECT payload FROM editing_run WHERE deck=$1 ORDER BY id", [deck])
  return {...state, events: events.rows.map(row => row.payload), runs: runs.rows.map(row => row.payload)}
}
export async function legacyHistoryArchive(tx: CatalogSql, deck: string, state: History): Promise<LegacyHistoryArchiveV2> {
  const history = await completeHistory(tx, deck, state)
  const events = await tx.query<{seq: number; commandBytes: string; receiptBytes: string}>("SELECT seq,command::text AS \"commandBytes\",receipt::text AS \"receiptBytes\" FROM editing_event WHERE deck=$1 ORDER BY seq", [deck])
  const receipts = await tx.query<{id: string; payload: string; receiptBytes: string}>("SELECT id,payload,receipt::text AS \"receiptBytes\" FROM editing_receipt WHERE deck=$1 ORDER BY id", [deck])
  return {version: 2, history, immutable: {version: 2, events: events.rows.map(row => {
    const command = decodeLegacyCommandV2({version: 2, command: JSON.parse(row.commandBytes)})
    const contribution = command.kind === "undo-change" ? history.events.find(event => event.id === command.target) : undefined
    const identity: ExecutionIdentity = (command.kind === "edit" || command.kind === "patch") && command.run !== null ? {kind: "run", run: command.run}
      : command.kind === "undo-change" ? {kind: "run", run: command.run, ...(contribution?.run && contribution.run !== command.run ? {undoOf: contribution.run} : {})} : {kind: "person"}
    return {...row, identity}
  }), receipts: receipts.rows.map(row => ({...row, id: commandId(row.id)}))}}
}
