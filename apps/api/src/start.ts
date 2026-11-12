import type { Socket } from "node:net"

import { anthropicTransport } from "./anthropic-transport.js"
import { DeckListen } from "./listen.js"
import { sendWithResend } from "./mail.js"
import { openPool } from "./pool.js"
import { createApi } from "./server.js"
import { readStartSettings } from "./start-settings.js"
import { drainOriginals } from "./original.js"
import { R2OriginalStore } from "./r2-original-store.js"

const settings = readStartSettings(process.env)

if ("refusal" in settings) {
  process.stderr.write(`${settings.refusal}\n`)
  process.exit(1)
}

const {
  sessionUrl,
  deckUrl,
  listenUrl,
  port,
  publicOrigin,
  siteOrigin,
  resource,
  cookieDomain,
  hosts,
  commit,
  smokeToken,
  resendKey,
  resendFrom,
  r2,
  forwardSecret,
  aira,
} = settings
const session = openPool(sessionUrl, "api-session")
const deck = openPool(deckUrl, "api-deck")
session.on("error", () => undefined)
deck.on("error", () => undefined)
const listen = new DeckListen(listenUrl)
const originals = r2 === undefined ? undefined : new R2OriginalStore(r2)
const server = createApi({
  session,
  deck,
  listen,
  publicOrigin,
  siteOrigin,
  resource,
  ...(originals === undefined ? {} : { originals }),
  ...(cookieDomain === undefined ? {} : { cookieDomain }),
  send: (mail) => sendWithResend(mail, { key: resendKey, from: resendFrom }),
  ...(hosts === undefined ? {} : { hosts }),
  ...(commit === undefined ? {} : { commit }),
  ...(smokeToken === undefined ? {} : { smokeToken }),
  ...(forwardSecret === undefined ? {} : { forwardSecret }),
  aira: { ...aira, transport: anthropicTransport() },
})
const sockets = new Set<Socket>()
server.on("connection", (socket) => {
  sockets.add(socket)
  socket.on("close", () => {
    sockets.delete(socket)
  })
})

function drain(): void {
  void drainOriginals(deck, originals)
}

drain()
const drainTimer = setInterval(drain, 3_600_000)
drainTimer.unref()

let stopping = false
function stop(): void {
  if (stopping) return
  stopping = true
  clearInterval(drainTimer)
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
