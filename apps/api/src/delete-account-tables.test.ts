import { Client } from "pg"
import { afterAll, beforeAll, expect, it } from "vitest"

import { accountTables } from "./testing/filled-account.js"
import { postgresInfo } from "./testing/harness.js"

const holdNoAccount = ["session.oauth_client"]

let admin = new Client()

beforeAll(async () => {
  admin = new Client({ connectionString: (await postgresInfo()).admin })
  await admin.connect()
})

afterAll(async () => {
  await admin.end()
})

it("checks every session and deck table for a deleted account's rows, or names it as holding none", async () => {
  const found = await admin.query<{ name: string }>(
    `select table_schema || '.' || table_name as name from information_schema.tables
     where table_schema in ('session', 'deck') and table_type = 'BASE TABLE' order by name`,
  )
  const checked = new Set<string>([...accountTables.map(([table]) => table), ...holdNoAccount])
  expect(found.rows.map((row) => row.name).filter((name) => !checked.has(name))).toEqual([])
})
