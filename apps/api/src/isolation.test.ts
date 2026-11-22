import { randomBytes } from "node:crypto"
import { Client, DatabaseError } from "pg"
import { describe, expect, it } from "vitest"

import { inDatabase, postgresInfo, unmigratedDatabase } from "./testing/harness.js"

async function marked(url: string, mark: string): Promise<number | null> {
  const client = new Client({ connectionString: url, application_name: "isolation-reader" })
  try {
    await client.connect()
  } catch (error) {
    if ((error as { code?: string }).code === "3D000") return null
    throw error
  }
  try {
    const found = await client.query<{ count: string }>("select count(*) from session.account where email like $1", [
      `${mark}%`,
    ])
    return Number(found.rows[0]?.count)
  } catch (error) {
    if (error instanceof DatabaseError && (error.code === "57P01" || error.code === "42P01")) return null
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }
}

describe("test databases", () => {
  it("can check for leaked accounts while another database is still empty", async () => {
    const empty = await unmigratedDatabase()
    try {
      expect(await marked(empty.admin, "isolation")).toBeNull()
    } finally {
      await empty.drop()
    }
  })

  it("shows a test file only the rows it wrote", async () => {
    const info = await postgresInfo()
    const own = new URL(info.admin).pathname.slice(1)
    const mark = `isolation${randomBytes(4).toString("hex")}`
    const writer = new Client({ connectionString: info.session, application_name: "isolation-writer" })
    await writer.connect()
    try {
      for (const index of [1, 2, 3]) {
        await writer.query("insert into session.account (email) values ($1)", [`${mark}${String(index)}@example.com`])
      }
      const listed = await writer.query<{ count: string }>("select count(*) from session.account")
      expect(Number(listed.rows[0]?.count)).toBe(3)
    } finally {
      await writer.end()
    }
    const admin = new Client({
      connectionString: inDatabase(info.admin, "postgres"),
      application_name: "isolation-admin",
    })
    await admin.connect()
    let others: string[] = []
    try {
      const found = await admin.query<{ datname: string }>(
        "select datname from pg_database where datname <> all($1::text[]) and datallowconn order by datname",
        [[own, "postgres", "template0", "template1"]],
      )
      others = found.rows.map((row) => row.datname)
    } finally {
      await admin.end()
    }
    expect(others).toContain("api")
    const seen = await Promise.all(others.map((database) => marked(inDatabase(info.admin, database), mark)))
    expect(seen.filter((count) => count !== null && count > 0)).toEqual([])
    expect(await marked(info.admin, mark)).toBe(3)
  })
})
