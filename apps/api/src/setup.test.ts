import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import path from "node:path"
import { Client } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { startEmptyCluster, type EmptyCluster } from "./postgres-setup.js"
import { provisionDatabase, type DatabaseUrls } from "./provision.js"

const entry = path.join(process.cwd(), "apps/api/dist/setup.js")

function password(): string {
  return randomBytes(18).toString("base64url")
}

function urlFor(port: number, user: string, secret: string, database: string): string {
  return `postgres://${user}:${encodeURIComponent(secret)}@127.0.0.1:${String(port)}/${database}`
}

async function openClient(url: string): Promise<Client> {
  const client = new Client({ connectionString: url })
  await client.connect()
  return client
}

function runEntry(env: NodeJS.ProcessEnv): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry], { env })
    let stderr = ""
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, stderr }))
  })
}

describe("database setup", () => {
  let cluster: EmptyCluster
  let counter = 0

  beforeAll(async () => {
    cluster = await startEmptyCluster()
  })

  afterAll(async () => {
    await cluster.stop()
  })

  async function freshDatabase(): Promise<{
    urls: DatabaseUrls
    secrets: Record<"session" | "deck" | "listen", string>
  }> {
    counter += 1
    const database = `setup_${String(counter)}`
    const bootstrap = await openClient(`postgres://postgres@127.0.0.1:${String(cluster.port)}/postgres`)
    await bootstrap.query(`create database ${database}`)
    await bootstrap.end()
    const secrets = { session: password(), deck: password(), listen: password() }
    return {
      secrets,
      urls: {
        admin: `postgres://postgres@127.0.0.1:${String(cluster.port)}/${database}`,
        session: urlFor(cluster.port, "session", secrets.session, database),
        deck: urlFor(cluster.port, "deck", secrets.deck, database),
        listen: urlFor(cluster.port, "listen", secrets.listen, database),
      },
    }
  }

  it("creates the three roles and the schema on an empty database", async () => {
    const { urls } = await freshDatabase()
    await expect(provisionDatabase(urls)).resolves.toBe("created")
    const session = await openClient(urls.session)
    const deck = await openClient(urls.deck)
    const listen = await openClient(urls.listen)
    try {
      await session.query("insert into session.account (email) values ('a@example.com')")
      await expect(deck.query("select email from session.account")).rejects.toThrow(/permission denied/)
      await expect(listen.query("select id from deck.saved")).resolves.toMatchObject({ rowCount: 0 })
      await expect(
        listen.query("insert into deck.saved (id, revision, register, owner) values ('d', 1, '{}', 'a@example.com')"),
      ).rejects.toThrow(/permission denied/)
    } finally {
      await Promise.all([session.end(), deck.end(), listen.end()])
    }
  })

  it("changes nothing on a second run", async () => {
    const { urls } = await freshDatabase()
    await provisionDatabase(urls)
    const session = await openClient(urls.session)
    try {
      await session.query("insert into session.account (email) values ('kept@example.com')")
      await expect(provisionDatabase(urls)).resolves.toBe("kept")
      const rows = await session.query<{ email: string }>("select email from session.account")
      expect(rows.rows).toEqual([{ email: "kept@example.com" }])
    } finally {
      await session.end()
    }
  })

  it("sets the password from the url when the role already exists", async () => {
    const { urls } = await freshDatabase()
    await provisionDatabase(urls)
    const database = new URL(urls.deck).pathname.slice(1)
    const changed = urlFor(cluster.port, "deck", password(), database)
    await expect(provisionDatabase({ ...urls, deck: changed })).resolves.toBe("kept")
    const reconnected = await openClient(changed)
    await reconnected.end()
    await expect(openClient(urls.deck)).rejects.toThrow(/password authentication failed/)
  })

  it("exits when a database url is missing", async () => {
    const { urls } = await freshDatabase()
    const result = await runEntry({
      PATH: process.env.PATH,
      SESSION_DATABASE_URL: urls.session,
      DECK_DATABASE_URL: urls.deck,
      LISTEN_DATABASE_URL: urls.listen,
    })
    expect(result.code).toBe(1)
    expect(result.stderr).toContain("ADMIN_DATABASE_URL")
    expect(result.stderr).not.toContain("postgres://")
  })
})
