import { PGlite } from "@electric-sql/pglite"
import { createHash } from "node:crypto"
import { expect, it } from "vitest"
import { createHistoryStore, historySchemaVersion } from "../src/db/history-store.ts"

const fingerprints: Record<number, string> = { 1: "c8d3c452904da12534bc2107eaf825a5df994e32757b9b046968ad349c283dbd", 2: "a00cc4bd0c336cfa47c4e33d8cd11ef7b27c6877bced2e1cfbc1a70ae60f9aa1" }

it("records a new history schema version whenever the migrated schema changes", async () => {
  const client = new PGlite()
  const store = await createHistoryStore({ kind: "pglite", client })
  try {
    const columns = await client.query("SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name")
    const indexes = await client.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")
    const constraints = await client.query("SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname")
    const fingerprint = createHash("sha256").update(JSON.stringify([columns.rows, indexes.rows, constraints.rows])).digest("hex")
    expect(fingerprints[historySchemaVersion], `The migrated history schema changed. Existing databases only migrate when historySchemaVersion rises, so bump it in apps/server/src/db/history-store.ts and record ${fingerprint} for the new version.`).toBe(fingerprint)
  } finally { await store.close() }
})
