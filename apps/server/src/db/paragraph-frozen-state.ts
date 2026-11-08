import type {CatalogSql} from "../../../../packages/catalog/src/index.ts"
import {parseDeck} from "../../../../packages/deck/src/index.ts"
import type {AgentRun} from "../../../../packages/agent/src/activity.ts"
import type {SavedVersion} from "../decks/export-store.ts"

export function validateSavedVersionV2(snapshot: SavedVersion) {
  parseDeck(snapshot.deck)
  if (!Number.isSafeInteger(snapshot.seq) || snapshot.seq < 0 || typeof snapshot.title !== "string" || (snapshot.source !== null && typeof snapshot.source !== "string")) throw new Error("invalid-saved-version-v2")
  return snapshot
}
export async function reconcileParagraphFrozenState(tx: CatalogSql) {
  const exports = await tx.query<{snapshot: SavedVersion}>("SELECT snapshot FROM deck_export WHERE snapshot IS NOT NULL")
  for (const row of exports.rows) validateSavedVersionV2(row.snapshot)
  await tx.query("UPDATE deck_export SET state='queued',lease=NULL,deadline=NULL,diagnostics=diagnostics || '[\"editing-protocol-lease-retired\"]'::jsonb WHERE state='running' AND snapshot IS NOT NULL")
  await tx.query("UPDATE deck_export SET state='failed',reason='editing-protocol-requires-new-snapshot',lease=NULL,deadline=NULL,diagnostics=diagnostics || '[\"editing-protocol-requires-new-snapshot\"]'::jsonb WHERE state IN ('waiting','queued','running') AND snapshot IS NULL")
  await tx.query("UPDATE tool_snapshot SET retired=true WHERE query<>'capture'")
  const agents = await tx.query<{id: string; data: AgentRun}>("SELECT id,data FROM aira_run WHERE data->>'kind'='working'")
  for (const {id, data} of agents.rows) {
    const nextId = Math.max(0, ...data.events.map(event => event.id)) + 1
    const stopped: AgentRun = {...data, kind: "stopped", events: [...data.events, {id: nextId, kind: "message", text: "Editing was updated. Your request is retained. Reconnect before resuming this run."}]}
    await tx.query("UPDATE aira_run SET data=$2 WHERE id=$1", [id, JSON.stringify(stopped)])
  }
}
