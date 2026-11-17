import { randomBytes } from "node:crypto"
import { spawn } from "node:child_process"
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import { constants, watch } from "node:fs"
import { createServer } from "node:net"
import os from "node:os"
import path from "node:path"
import { Client } from "pg"

import { createRole } from "./provision.js"
import { applySchema } from "./schema.js"

export const testWorkerConnections = (cores: number) => Math.max(100, cores * 16)

export const clusterFile = () => path.join(process.cwd(), "node_modules/.cache/airdesign-api-postgres.json")

type Info = {
  readonly dir: string
  readonly bin: string
  readonly library: string | null
  readonly port: number
  readonly admin: string
  readonly session: string
  readonly deck: string
  readonly listen: string
}

function envFor(library: string | null): NodeJS.ProcessEnv {
  if (library === null) return process.env
  const current = process.env.LD_LIBRARY_PATH
  const joined = current === undefined || current.length === 0 ? library : `${library}:${current}`
  return { ...process.env, LD_LIBRARY_PATH: joined }
}

function capture(command: string, args: readonly string[], library: string | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: envFor(library) })
    let out = ""
    let err = ""
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (status) => {
      if (status !== 0) reject(new Error(`${path.basename(command)} exited ${status ?? 1}: ${err || out}`))
      else resolve(out)
    })
  })
}

async function libraryBeside(bin: string): Promise<string | null> {
  const lib = path.resolve(bin, "../../..")
  let entries: string[]
  try {
    entries = await readdir(lib)
  } catch {
    return null
  }
  for (const entry of entries) {
    const dir = path.join(lib, entry)
    try {
      await access(path.join(dir, "libpq.so.5"), constants.R_OK)
      return dir
    } catch {
      continue
    }
  }
  return null
}

async function findPostgres(): Promise<{ bin: string; library: string | null }> {
  const configured = process.env.AIRDESIGN_POSTGRES_BIN
  const dirs = [
    configured,
    "/usr/lib/postgresql/18/bin",
    path.join(os.homedir(), ".local/pgsql-18/usr/lib/postgresql/18/bin"),
  ].filter((dir): dir is string => typeof dir === "string" && dir.length > 0)
  const errors: string[] = []
  for (const bin of dirs) {
    try {
      await access(path.join(bin, "postgres"), constants.X_OK)
      await access(path.join(bin, "initdb"), constants.X_OK)
    } catch {
      continue
    }
    const library = await libraryBeside(bin)
    try {
      const version = await capture(path.join(bin, "postgres"), ["--version"], library)
      if (!/\b18\./.test(version)) {
        errors.push(version.trim())
        continue
      }
      return { bin, library }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "postgres")
    }
  }
  throw new Error(`PostgreSQL 18 was not found. ${errors.join(" ")}`)
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (address === null || typeof address === "string") {
        server.close()
        reject(new Error("port"))
        return
      }
      const { port } = address
      server.close((error) => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })
}

function roleUrl(port: number, role: string, password: string): string {
  return `postgres://${encodeURIComponent(role)}:${encodeURIComponent(password)}@127.0.0.1:${String(port)}/api`
}

async function prepare(
  info: Info,
  sessionPassword: string,
  deckPassword: string,
  listenPassword: string,
): Promise<void> {
  const admin = new Client({ connectionString: info.admin })
  await admin.connect()
  await createRole(admin, "session", sessionPassword)
  await createRole(admin, "deck", deckPassword)
  await createRole(admin, "listen", listenPassword)
  await applySchema(admin)
  await admin.end()
}

async function launch(
  verifyPasswords: boolean,
): Promise<{ found: { bin: string; library: string | null }; dir: string; port: number }> {
  const found = await findPostgres()
  const root = path.join(os.homedir(), "tmp")
  await mkdir(root, { recursive: true })
  const dir = await mkdtemp(path.join(root, "airdesign-api-"))
  const port = await freePort()
  await capture(
    path.join(found.bin, "initdb"),
    [
      "-D",
      path.join(dir, "data"),
      "-U",
      "postgres",
      "--auth=trust",
      "--locale=C",
      "--encoding=UTF8",
      "--no-sync",
      "--no-instructions",
    ],
    found.library,
  )
  if (verifyPasswords) {
    await writeFile(
      path.join(dir, "data/pg_hba.conf"),
      "local all all trust\nhost all postgres 127.0.0.1/32 trust\nhost all all 127.0.0.1/32 scram-sha-256\n",
    )
  }
  await capture(
    path.join(found.bin, "pg_ctl"),
    [
      "-D",
      path.join(dir, "data"),
      "-l",
      path.join(dir, "server.log"),
      "-w",
      "start",
      "-o",
      `-p ${String(port)} -k ${dir} -c listen_addresses=127.0.0.1 -c max_connections=${String(testWorkerConnections(os.availableParallelism()))} -c synchronous_commit=on -c fsync=off -c full_page_writes=off`,
    ],
    found.library,
  )
  const bootstrap = new Client({ connectionString: `postgres://postgres@127.0.0.1:${String(port)}/postgres` })
  await bootstrap.connect()
  await bootstrap.query("create database api")
  await bootstrap.end()
  return { found, dir, port }
}

export type EmptyCluster = {
  readonly port: number
  readonly admin: string
  readonly stop: () => Promise<void>
}

export async function startEmptyCluster(): Promise<EmptyCluster> {
  const { found, dir, port } = await launch(true)
  const info: Info = {
    dir,
    bin: found.bin,
    library: found.library,
    port,
    admin: `postgres://postgres@127.0.0.1:${String(port)}/api`,
    session: "",
    deck: "",
    listen: "",
  }
  return { port, admin: info.admin, stop: () => stop(info) }
}

async function start(): Promise<Info> {
  const { found, dir, port } = await launch(false)
  const sessionPassword = randomBytes(18).toString("base64url")
  const deckPassword = randomBytes(18).toString("base64url")
  const listenPassword = randomBytes(18).toString("base64url")
  const info: Info = {
    dir,
    bin: found.bin,
    library: found.library,
    port,
    admin: `postgres://postgres@127.0.0.1:${String(port)}/api`,
    session: roleUrl(port, "session", sessionPassword),
    deck: roleUrl(port, "deck", deckPassword),
    listen: roleUrl(port, "listen", listenPassword),
  }
  try {
    await prepare(info, sessionPassword, deckPassword, listenPassword)
  } catch (error) {
    await stop(info)
    throw error
  }
  return info
}

async function stop(info: Info): Promise<void> {
  await capture(
    path.join(info.bin, "pg_ctl"),
    ["-D", path.join(info.dir, "data"), "-w", "-m", "immediate", "stop"],
    info.library,
  ).catch(() => undefined)
  await rm(info.dir, { recursive: true, force: true })
}

async function stopLeftover(): Promise<void> {
  const leftover = await readFile(clusterFile(), "utf8")
    .then((text) => JSON.parse(text) as Partial<Info>)
    .catch(() => undefined)
  if (leftover?.bin !== undefined && leftover.dir !== undefined) await stop(leftover as Info)
  await rm(clusterFile(), { force: true })
}

export async function publishCluster(file: string, cluster: object): Promise<void> {
  const draft = `${file}.${String(process.pid)}.draft`
  await writeFile(draft, `${JSON.stringify(cluster)}\n`)
  await rename(draft, file)
}

export function publishedCluster<T>(file: string, limitMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const watcher = watch(path.dirname(file), () => look())
    const timer = setTimeout(
      () => settle(() => reject(new Error(`No Postgres cluster was published in ${file}.`))),
      limitMs,
    )
    function settle(then: () => void): void {
      if (settled) return
      settled = true
      watcher.close()
      clearTimeout(timer)
      then()
    }
    function look(): void {
      readFile(file, "utf8").then(
        (text) => {
          const cluster = JSON.parse(text) as T | { readonly error: string }
          settle(() =>
            typeof cluster === "object" && cluster !== null && "error" in cluster
              ? reject(new Error(cluster.error))
              : resolve(cluster),
          )
        },
        () => undefined,
      )
    }
    look()
  })
}

type Held = { users: number; readonly cleared: Promise<void>; readonly starting: Promise<void> }

const heldKey = Symbol.for("airdesign.api-postgres")
const holder = globalThis as { [heldKey]?: Held }

async function clearLeftover(): Promise<void> {
  await stopLeftover()
  await mkdir(path.dirname(clusterFile()), { recursive: true })
}

export async function setup(): Promise<void> {
  const held = holder[heldKey]
  if (held !== undefined) {
    held.users += 1
    await held.cleared
    return
  }
  const cleared = clearLeftover()
  const starting = cleared
    .then(start)
    .then(
      (info) => publishCluster(clusterFile(), info),
      (error: unknown) => publishCluster(clusterFile(), { error: error instanceof Error ? error.message : "postgres" }),
    )
    .catch(() => undefined)
  holder[heldKey] = { users: 1, cleared, starting }
  await cleared
}

export async function teardown(): Promise<void> {
  const held = holder[heldKey]
  if (held === undefined) return
  held.users -= 1
  if (held.users > 0) return
  delete holder[heldKey]
  await held.starting
  await stopLeftover()
}
