import type { LayoutComparison } from "@airdesign/fonts"
import type { Socket } from "node:net"

import { anthropicTransport } from "./aira/anthropic-transport.js"
import { DeckListen } from "./platform/listen.js"
import { sendWithResend } from "./platform/mail.js"
import { openPool } from "./platform/pool.js"
import { createApi } from "./server.js"
import { readStartSettings } from "./platform/start-settings.js"
import { drainOriginals } from "./doom/original.js"
import { endIdleRuns, runIdle } from "./doom/idle-runs.js"
import { R2OriginalStore } from "./platform/r2-original-store.js"

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
  compareFontLayout,
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
  ...(compareFontLayout
    ? {
        recordFontComparison: (result: LayoutComparison) => console.info("Served font comparison", result),
      }
    : {}),
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

const idleTimer = setInterval(() => {
  endIdleRuns(deck, new Date(Date.now() - runIdle)).catch(() => {
    process.stderr.write("api idle runs failed\n")
  })
}, 20_000)
idleTimer.unref()

let stopping = false
function stop(): void {
  if (stopping) return
  stopping = true
  clearInterval(drainTimer)
  clearInterval(idleTimer)
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
