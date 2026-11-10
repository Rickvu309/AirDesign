import { DeckListen } from "./listen.js"
import { sendWithResend } from "./mail.js"
import { openPool } from "./pool.js"
import { createApi } from "./server.js"

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
  return Number(text)
}

const session = openPool(sessionUrl, "api-session")
const deck = openPool(deckUrl, "api-deck")
session.on("error", () => undefined)
deck.on("error", () => undefined)
const listen = new DeckListen(listenUrl)
const server = createApi({
  session,
  deck,
  listen,
  send: (mail) => sendWithResend(mail),
})
server.listen(portNumber(), "0.0.0.0")
