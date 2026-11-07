import {randomBytes} from "node:crypto"
import {mkdir} from "node:fs/promises"
import path from "node:path"
import {drizzle} from "drizzle-orm/pglite"
import {drizzle as drizzlePg} from "drizzle-orm/node-postgres"
import {PGlite} from "@electric-sql/pglite"
import pg from "pg"
import {dropDisposableSchemaSql} from "./disposable-schema.ts"
import {accessSchemaSql,accessTables,applicationSchemaName} from "./schema.ts"
import type {AccessDriver} from "./create-access.ts"
type Database = ReturnType<typeof drizzle<ReturnType<typeof accessTables>>>
type Tables = ReturnType<typeof accessTables>

export async function openDatabase(driver: AccessDriver): Promise<{ db: Database; tables: Tables; close: () => Promise<void> }> {
  if (driver.kind === "pglite") {
    if (driver.dataDir && driver.dataDir !== "memory://") await mkdir(path.dirname(driver.dataDir), { recursive: true, mode: 0o700 })
    const schemaName = driver.dataDir ? applicationSchemaName : `ns_${randomBytes(8).toString("hex")}`
    const tables = accessTables(schemaName)
    const client = driver.client ?? await PGlite.create(driver.dataDir)
    await client.exec(accessSchemaSql(schemaName, driver.dataDir ? "stable" : "disposable"))
    const db = drizzle(client, { schema: tables })
    let closed = false
    return {
      db,
      tables,
      async close() {
        if (closed) {
          return
        }
        closed = true
        if (!driver.dataDir) await client.exec(dropDisposableSchemaSql(schemaName))
        if (!driver.client) await client.close()
      },
    }
  }
  const tables = accessTables(applicationSchemaName)
  const pool = new pg.Pool({ connectionString: driver.url })
  const connections = new Set<Promise<void>>()
  pool.on("connect", client => {
    const ended = new Promise<void>(resolve => client.once("end", resolve))
    connections.add(ended)
    void ended.then(() => connections.delete(ended))
  })
  await pool.query(accessSchemaSql(applicationSchemaName, "stable"))
  const db = drizzlePg(pool, { schema: tables }) as unknown as Database
  let closed = false
  return {
    db,
    tables,
    async close() {
      if (closed) {
        return
      }
      closed = true
      await pool.end()
      await Promise.all(connections)
    },
  }
}
