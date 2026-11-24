import { randomBytes } from "node:crypto"
import { spawn } from "node:child_process"
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import { constants, readFileSync, readlinkSync, realpathSync, watch } from "node:fs"
import os from "node:os"
import path from "node:path"
import { setTimeout as pause } from "node:timers/promises"
import { Client } from "pg"

import { onFreePort } from "./free-port.js"
import { removeLeftoverClusters } from "./leftover-clusters.js"
import { createRole } from "../platform/provision.js"
import { applySchema } from "../platform/schema.js"

export const testWorkerConnections = (cores: number) => Math.max(100, cores * 16)

export const clusterFile = () => path.join(process.cwd(), "node_modules/.cache/airdesign-api-postgres.json")

type Info = {
  readonly dir: string
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

type OwnedCluster = { readonly dir: string; readonly signal: AbortSignal }

async function clusterDirectory(): Promise<string> {
  const root = path.join(os.homedir(), "tmp")
  await mkdir(root, { recursive: true })
  await removeLeftoverClusters(root)
  return mkdtemp(path.join(root, "airdesign-api-"))
}

async function launch(
  verifyPasswords: boolean,
  pick?: () => Promise<number>,
  owned?: OwnedCluster,
): Promise<{ dir: string; port: number }> {
  const found = await findPostgres()
  const signal = owned?.signal
  signal?.throwIfAborted()
  const dir = owned?.dir ?? (await clusterDirectory())
  if (owned !== undefined) await mkdir(dir)
  try {
    signal?.throwIfAborted()
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
    const log = path.join(dir, "server.log")
    const socket = owned === undefined ? `-k ${dir}` : "-c unix_socket_directories="
    const port = await onFreePort({
      pick,
      start: async (picked) => {
        await rm(log, { force: true })
        signal?.throwIfAborted()
        try {
          await capture(
            path.join(found.bin, "pg_ctl"),
            [
              "-D",
              path.join(dir, "data"),
              "-l",
              log,
              "-w",
              "start",
              "-o",
              `-p ${String(picked)} ${socket} -c listen_addresses=127.0.0.1 -c max_connections=${String(testWorkerConnections(os.availableParallelism()))} -c synchronous_commit=on -c fsync=off -c full_page_writes=off`,
            ],
            found.library,
          )
        } catch (error) {
          signal?.throwIfAborted()
          const why = await readFile(log, "utf8").catch(() => "")
          throw new Error(`${error instanceof Error ? error.message : String(error)}\n${why}`)
        }
        return picked
      },
    })
    signal?.throwIfAborted()
    const bootstrap = new Client({
      connectionString: `postgres://postgres@127.0.0.1:${String(port)}/postgres`,
      connectionTimeoutMillis: 5_000,
    })
    try {
      await bootstrap.connect()
      await bootstrap.query("create database api")
    } finally {
      await bootstrap.end()
    }
    signal?.throwIfAborted()
    return { dir, port }
  } catch (error) {
    await stop(dir)
    throw error
  }
}

export type EmptyCluster = {
  readonly port: number
  readonly admin: string
  readonly stop: () => Promise<void>
}

export async function startEmptyCluster(pick?: () => Promise<number>): Promise<EmptyCluster> {
  return emptyCluster(await launch(true, pick))
}

export async function startOwnedEmptyCluster(owned: OwnedCluster): Promise<EmptyCluster> {
  return emptyCluster(await launch(true, undefined, owned))
}

function emptyCluster({ dir, port }: Awaited<ReturnType<typeof launch>>): EmptyCluster {
  return { port, admin: `postgres://postgres@127.0.0.1:${String(port)}/api`, stop: () => stop(dir) }
}

async function start(): Promise<Info> {
  const { dir, port } = await launch(false)
  const sessionPassword = randomBytes(18).toString("base64url")
  const deckPassword = randomBytes(18).toString("base64url")
  const listenPassword = randomBytes(18).toString("base64url")
  const info: Info = {
    dir,
    port,
    admin: `postgres://postgres@127.0.0.1:${String(port)}/api`,
    session: roleUrl(port, "session", sessionPassword),
    deck: roleUrl(port, "deck", deckPassword),
    listen: roleUrl(port, "listen", listenPassword),
  }
  try {
    await prepare(info, sessionPassword, deckPassword, listenPassword)
  } catch (error) {
    await stop(dir)
    throw error
  }
  return info
}

function postmasterMatches(pid: number, dataDir: string): boolean {
  try {
    if (path.basename(readlinkSync(`/proc/${String(pid)}/exe`)) !== "postgres") return false
    const args = readFileSync(`/proc/${String(pid)}/cmdline`, "utf8").split("\0")
    const flag = args.lastIndexOf("-D")
    return flag >= 0 && args[flag + 1] === dataDir
  } catch {
    return false
  }
}

async function stop(dir: string): Promise<void> {
  const dataDir = path.join(dir, "data")
  const pidFile = path.join(dataDir, "postmaster.pid")
  try {
    const [pidText, directory] = readFileSync(pidFile, "utf8").split("\n")
    const pid = Number(pidText)
    if (pidText !== undefined && /^[1-9]\d*$/.test(pidText) && Number.isSafeInteger(pid)) {
      process.kill(pid, 0)
      const realDir = path.join(realpathSync(path.dirname(dir)), path.basename(dir))
      const realPidFile = path.join(realDir, "data", "postmaster.pid")
      if (directory !== dataDir || realpathSync(pidFile) !== realPidFile || !postmasterMatches(pid, dataDir))
        throw new Error(`could not verify the postmaster for ${dir}`)
      process.kill(pid, "SIGQUIT")
      for (let waited = 0; waited < 15_000 && postmasterMatches(pid, dataDir); waited += 100) await pause(100)
      if (postmasterMatches(pid, dataDir)) throw new Error(`Postgres for ${dir} did not stop`)
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ESRCH"))) throw error
  }
  await rm(dir, { recursive: true, force: true })
}

async function stopLeftover(): Promise<void> {
  const leftover = await readFile(clusterFile(), "utf8")
    .then((text) => JSON.parse(text) as Partial<Info>)
    .catch(() => undefined)
  if (typeof leftover?.dir === "string") await stop(leftover.dir)
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
