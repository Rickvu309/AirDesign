import type { Socket } from "node:net"

import { DeckListen } from "./listen.js"
import { sendWithResend } from "./mail.js"
import { openPool } from "./pool.js"
import { createApi, requireDomain, requireOrigin } from "./server.js"

const databaseNames = ["SESSION_DATABASE_URL", "DECK_DATABASE_URL", "LISTEN_DATABASE_URL"] as const

function databaseUrl(name: string): string | undefined {
  const value = process.env[name]
  if (value === undefined || value.length === 0) return undefined
  return value
}

const urls = databaseNames.map((name) => databaseUrl(name))
const missing = databaseNames.filter((_, index) => urls[index] === undefined)
const sessionUrl = urls[0]
const deckUrl = urls[1]
const listenUrl = urls[2]

if (sessionUrl === undefined || deckUrl === undefined || listenUrl === undefined) {
  process.stderr.write(`${missing.join(" ")}\n`)
  process.exit(1)
}

function portNumber(): number {
  const text = process.env.PORT
  if (text === undefined || text.length === 0) return 3000
  if (!/^[0-9]+$/.test(text)) return Number.NaN
  const port = Number(text)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return Number.NaN
  return port
}

const port = portNumber()
if (Number.isNaN(port)) {
  process.stderr.write("PORT\n")
  process.exit(1)
}

function readSetting(name: string, check: (value: string) => void): string {
  const value = process.env[name] ?? ""
  try {
    check(value)
  } catch {
    process.stderr.write(`${name}\n`)
    process.exit(1)
  }
  return value
}

const publicOrigin = readSetting("PUBLIC_ORIGIN", (value) => {
  requireOrigin("publicOrigin", value)
})
const siteOrigin = readSetting("SITE_ORIGIN", (value) => {
  requireOrigin("siteOrigin", value)
})
const cookieDomain = (process.env.COOKIE_DOMAIN ?? "") === "" ? undefined : readSetting("COOKIE_DOMAIN", requireDomain)

const session = openPool(sessionUrl, "api-session")
const deck = openPool(deckUrl, "api-deck")
session.on("error", () => undefined)
deck.on("error", () => undefined)
const listen = new DeckListen(listenUrl)
const server = createApi({
  session,
  deck,
  listen,
  publicOrigin,
  siteOrigin,
  ...(cookieDomain === undefined ? {} : { cookieDomain }),
  send: (mail) => sendWithResend(mail),
})
const sockets = new Set<Socket>()
server.on("connection", (socket) => {
  sockets.add(socket)
  socket.on("close", () => {
    sockets.delete(socket)
  })
})

let stopping = false
function stop(): void {
  if (stopping) return
  stopping = true
  const force = setTimeout(() => {
    process.exit(0)
  }, 5000)
  server.close()
  for (const socket of sockets) socket.destroy()
  void listen
    .close()
    .then(() => session.end())
    .then(() => deck.end())
    .then(() => {
      clearTimeout(force)
      process.exit(0)
    })
    .catch(() => {
      process.exit(0)
    })
}

process.on("SIGTERM", stop)
process.on("SIGINT", stop)
server.listen(port, "0.0.0.0")
