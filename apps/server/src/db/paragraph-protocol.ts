import {readFile} from "node:fs/promises"
import type pg from "pg"
import type {CatalogSql} from "../../../../packages/catalog/src/index.ts"
import {admitTextProtocol, initialTextAdmission, type TextAdmission, type TextProtocol} from "../../../../packages/rpc/src/text/protocol.ts"

const dependentTables = ["aira_run", "catalog_request", "catalog_source", "deck_export", "editing_contribution", "editing_event", "editing_key", "editing_property", "editing_receipt", "editing_run", "editing_run_credential", "tool_cursor", "tool_snapshot"]
export const paragraphLockTables = ["editing_deck", ...dependentTables, "editing_paragraph", "editing_protocol"]
export async function lockParagraphRelations(tx: CatalogSql) {
  await tx.query("LOCK TABLE editing_deck IN ACCESS EXCLUSIVE MODE")
  const locked = performance.now()
  for (const table of paragraphLockTables) if (table !== "editing_protocol" && table !== "editing_deck") await tx.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`)
  return locked
}
export async function paragraphAdmission(tx: CatalogSql, requested: TextProtocol) {
  const row = (await tx.query<{protocol: TextProtocol; paused: boolean}>("SELECT protocol,paused FROM editing_protocol WHERE singleton FOR SHARE")).rows[0]
  if (!row) throw new Error("paragraph-protocol-missing")
  const result = admitTextProtocol({kind: row.paused ? "paused" : "ready", protocol: row.protocol}, requested)
  if (result.kind === "refused") throw new Error(result.code)
}
export async function paragraphProtocol(tx: CatalogSql): Promise<TextAdmission> {
  if (!(await tx.query<{relation: string | null}>("SELECT to_regclass('editing_protocol') AS relation")).rows[0]?.relation) return initialTextAdmission
  const row = (await tx.query<{protocol: TextProtocol; paused: boolean}>("SELECT protocol,paused FROM editing_protocol WHERE singleton")).rows[0]
  if (!row) throw new Error("paragraph-protocol-missing")
  return {kind: row.paused ? "paused" : "ready", protocol: row.protocol}
}
export async function pauseParagraphEditing(client: pg.Client, paused: boolean) {
  await client.query("BEGIN")
  try {
    await nativeParagraphCapability(client)
    await client.query("UPDATE editing_protocol SET paused=$1 WHERE singleton", [paused])
    await client.query("COMMIT")
  } catch (error) { await client.query("ROLLBACK"); throw error }
}
export async function nativeParagraphCapability(tx: CatalogSql) {
  await tx.query("SET LOCAL airdesign.history_protocol='paragraph-body-v3'")
}
export async function prepareParagraphCutover(client: pg.Client) {
  await client.query("BEGIN")
  try {
    await client.query("SET LOCAL lock_timeout='1000ms'")
    await client.query("LOCK TABLE editing_deck IN ACCESS EXCLUSIVE MODE")
    for (const table of dependentTables) await client.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`)
    await nativeParagraphCapability(client)
    await client.query("CREATE TABLE IF NOT EXISTS editing_protocol(singleton boolean PRIMARY KEY CHECK(singleton),protocol text NOT NULL CHECK(protocol IN ('legacy-text-v2','paragraph-body-v3')))")
    await client.query("INSERT INTO editing_protocol(singleton,protocol) VALUES(true,'legacy-text-v2') ON CONFLICT DO NOTHING")
    await client.query("ALTER TABLE editing_protocol ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false")
    await client.query("ALTER TABLE deck_export ADD COLUMN IF NOT EXISTS snapshot_version integer NOT NULL DEFAULT 2 CHECK(snapshot_version IN (2,3))")
    await client.query("ALTER TABLE deck_export DROP CONSTRAINT IF EXISTS deck_export_snapshot_version_check")
    await client.query("ALTER TABLE deck_export ADD CONSTRAINT deck_export_snapshot_version_check CHECK(snapshot_version IN (2,3))")
    await client.query("ALTER TABLE tool_snapshot ADD COLUMN IF NOT EXISTS retired boolean NOT NULL DEFAULT false")
    await client.query("ALTER TABLE aira_run ADD COLUMN IF NOT EXISTS text_protocol text NOT NULL DEFAULT 'legacy-text-v2' CHECK(text_protocol IN ('legacy-text-v2','paragraph-body-v3'))")
    await client.query("CREATE TABLE IF NOT EXISTS editing_paragraph(deck text PRIMARY KEY REFERENCES editing_deck(id) ON DELETE CASCADE,version integer NOT NULL CHECK(version=3),metadata jsonb NOT NULL)")
    await client.query("ALTER TABLE editing_event ADD COLUMN IF NOT EXISTS history_version integer NOT NULL DEFAULT 2 CHECK(history_version IN (2,3))")
    await client.query("ALTER TABLE editing_receipt ADD COLUMN IF NOT EXISTS history_version integer NOT NULL DEFAULT 2 CHECK(history_version IN (2,3))")
    await client.query(await readFile(new URL("./migrations/editing_protocol_fence.sql", import.meta.url), "utf8"))
    await client.query(await readFile(new URL("./migrations/editing_protocol_marker_fence.sql", import.meta.url), "utf8"))
    for (const table of paragraphLockTables) {
      await client.query(`DROP TRIGGER IF EXISTS editing_protocol_fence ON ${table}`)
      await client.query(`CREATE TRIGGER editing_protocol_fence BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON ${table} FOR EACH STATEMENT EXECUTE FUNCTION ${table === "editing_protocol" ? "editing_protocol_marker_fence" : "editing_protocol_fence"}()`)
    }
    await client.query("COMMIT")
  } catch (error) { await client.query("ROLLBACK"); throw error }
}
