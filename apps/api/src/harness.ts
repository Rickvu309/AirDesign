import { readCommit } from "@airdesign/catalog"
import { randomBytes } from "node:crypto"
import { request, type IncomingHttpHeaders, type Server } from "node:http"
import { readFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import path from "node:path"
import { Client } from "pg"
import { afterAll } from "vitest"

import { createApi, type ApiOptions, type Commit } from "./index.js"

export type PostgresInfo = {
  readonly admin: string
  readonly session: string
  readonly deck: string
  readonly listen: string
}

export function inDatabase(url: string, database: string): string {
  const moved = new URL(url)
  moved.pathname = `/${database}`
  return moved.toString()
}

function databaseOf(url: string): string {
  return new URL(url).pathname.slice(1)
}

async function onCluster(info: PostgresInfo, statement: string): Promise<void> {
  const admin = new Client({ connectionString: inDatabase(info.admin, "postgres"), application_name: "api-database" })
  await admin.connect()
  try {
    await admin.query(statement)
  } finally {
    await admin.end()
  }
}

async function ownDatabase(): Promise<PostgresInfo> {
  const file = path.join(process.cwd(), "node_modules/.cache/airdesign-api-postgres.json")
  const template = JSON.parse(await readFile(file, "utf8")) as PostgresInfo
  const database = `file_${String(process.pid)}_${randomBytes(6).toString("hex")}`
  await onCluster(template, `create database ${database} template ${databaseOf(template.admin)}`)
  return {
    admin: inDatabase(template.admin, database),
    session: inDatabase(template.session, database),
    deck: inDatabase(template.deck, database),
    listen: inDatabase(template.listen, database),
  }
}

let own: Promise<PostgresInfo> | undefined

export function postgresInfo(): Promise<PostgresInfo> {
  own ??= ownDatabase()
  return own
}

afterAll(async () => {
  if (own === undefined) return
  const info = await own
  own = undefined
  await onCluster(info, `drop database if exists ${databaseOf(info.admin)}`).catch((error: unknown) => {
    if ((error as { code?: string }).code !== "55006") throw error
  })
})

export function cookieFrom(headers: IncomingHttpHeaders): string | undefined {
  const header = headers["set-cookie"]
  const first = header?.[0]
  if (first === undefined) return undefined
  return first.split(";")[0]
}

type Reply = {
  readonly status: number
  readonly headers: IncomingHttpHeaders
  readonly json: unknown
  readonly text: string
}

function send(
  base: string,
  method: string,
  route: string,
  payload: Buffer | undefined,
  contentType: string,
  cookie?: string,
): Promise<Reply> {
  const url = new URL(route, base)
  return new Promise((resolve, reject) => {
    const req = request(
      {
        method,
        hostname: "127.0.0.1",
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers: {
          ...(payload === undefined ? {} : { "content-type": contentType, "content-length": String(payload.length) }),
          ...(cookie === undefined ? {} : { cookie }),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk)
        })
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8")
          let json: unknown
          if (text.length === 0) json = undefined
          else {
            try {
              json = JSON.parse(text) as unknown
            } catch {
              json = undefined
            }
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, json, text })
        })
      },
    )
    req.on("error", reject)
    if (payload === undefined) req.end()
    else req.end(payload)
  })
}

export async function ask(
  base: string,
  method: string,
  route: string,
  body?: unknown,
  cookie?: string,
): Promise<Reply> {
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
  return send(base, method, route, payload, "application/json", cookie)
}

export async function askForm(base: string, route: string, fields: Record<string, string>): Promise<Reply> {
  const payload = Buffer.from(new URLSearchParams(fields).toString())
  return send(base, "POST", route, payload, "application/x-www-form-urlencoded")
}

export function wireCommit(raw: unknown): Commit {
  const parsed = readCommit(raw)
  if (!parsed.ok) throw new Error(parsed.refusal)
  return parsed
}

export const testResource = "https://mcp.example.test/mcp"

export async function serve(
  options: Omit<ApiOptions, "resource"> & { readonly resource?: string },
): Promise<{ readonly base: string; readonly server: Server; readonly close: () => Promise<void> }> {
  const server = createApi({ resource: testResource, ...options })
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const address = server.address() as AddressInfo
  return {
    base: `http://127.0.0.1:${String(address.port)}`,
    server,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      }),
  }
}
