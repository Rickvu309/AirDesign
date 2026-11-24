import { randomBytes } from "node:crypto"
import { connect, createServer, type AddressInfo, type Server, type Socket } from "node:net"
import { doomRoutes } from "@airdesign/catalog"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo, serve, signInByCode } from "./testing/harness.js"
import { heldQueries, type HeldQueries } from "./testing/held-queries.js"
import { startIds } from "./doom/doom-start.js"
import { DeckListen, openPool, type Mail } from "./index.js"

type Gate = { readonly url: string; readonly cut: () => void; readonly open: () => void; readonly close: () => void }

function gateTo(target: string): Promise<Gate> {
  const address = new URL(target)
  const sockets = new Set<Socket>()
  const waiting: (() => void)[] = []
  let shut = false
  const server: Server = createServer((socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
    socket.on("error", () => undefined)
    const pass = () => {
      const upstream = connect(Number(address.port), address.hostname)
      sockets.add(upstream)
      upstream.on("close", () => sockets.delete(upstream))
      upstream.on("error", () => socket.destroy())
      socket.on("close", () => upstream.destroy())
      upstream.on("close", () => socket.destroy())
      socket.pipe(upstream).pipe(socket)
    }
    if (shut) waiting.push(pass)
    else pass()
  })
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port
      const url = new URL(target)
      url.port = String(port)
      resolve({
        url: url.toString(),
        cut: () => {
          shut = true
          for (const socket of sockets) socket.destroy()
        },
        open: () => {
          shut = false
          for (const pass of waiting.splice(0)) pass()
        },
        close: () => {
          for (const socket of sockets) socket.destroy()
          server.close()
        },
      })
    })
  })
}

const mails: Mail[] = []
let base = ""
let cookie = ""
let gate: Gate | undefined
let counted: HeldQueries | undefined
let close = async () => {}

beforeAll(async () => {
  const info = await postgresInfo()
  const session = openPool(info.session, "listen-wake-session")
  const deck = openPool(info.deck, "listen-wake-deck")
  counted = heldQueries(deck)
  gate = await gateTo(info.listen)
  const listen = new DeckListen(gate.url)
  const served = await serve({
    session,
    deck: counted.db,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    send: async (mail) => {
      mails.push(mail)
    },
  })
  base = served.base
  cookie = await signInByCode(base, mails, `wake${randomBytes(4).toString("hex")}@example.com`)
  close = async () => {
    await served.close()
    await listen.close()
    gate?.close()
    await Promise.all([session.end(), deck.end()])
  }
})

afterAll(async () => {
  await close()
})

const post = async (route: keyof typeof doomRoutes, body: unknown): Promise<unknown> =>
  (await ask(base, "POST", doomRoutes[route].path, body, cookie)).json

describe("the deck listener", () => {
  it("wakes a held catch-up when it connects again, for an edit that landed while it was cut off", async () => {
    const deck = `wake${randomBytes(6).toString("hex")}`
    expect(await post("create", { deck })).toMatchObject({ ok: true })
    const read = counted!.hold("rev > $2")
    const held = post("since", { deck, rev: 1, wait: true })
    await read.reached
    read.release()
    await read.answered
    gate!.cut()
    const edit = {
      once: `wake-${randomBytes(4).toString("hex")}`,
      author: { kind: "person", id: "tab" },
      writes: [{ node: startIds.deck, prop: "name", value: "Landed while cut off" }],
    }
    expect(await post("edit", { deck, edit })).toMatchObject({ ok: true })
    gate!.open()
    expect(await held).toMatchObject({ ok: true, rev: 2, edits: [{ rev: 2 }] })
  })
})
