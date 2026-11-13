import { deckRoutes, type OpenResult } from "@airdesign/catalog"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
  firstAccount,
  installIndexedDb,
  installParts,
  secondAccount,
  signInAs,
  tracedRemote,
} from "./browser-fixtures.js"
import { deleteDatabase, memoryRemote, putParts, queueOriginal, sendUnopened, type Remote } from "./index.js"

const imported = "imported-deck"
const at = Date.parse("2026-11-13T09:00:00Z")
const shown = { deck: imported, name: "clean", created: "2026-11-13T09:00:00.000Z" }

beforeEach(async () => {
  installIndexedDb()
  installParts()
  await putParts(imported, {
    parts: new Map([["ppt/presentation.xml", new Uint8Array([1])]]),
    file: new Uint8Array([2]),
    name: "clean",
  })
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

function renames(): unknown[] {
  const sent: unknown[] = []
  vi.stubGlobal("fetch", async (path: string, init: RequestInit) => {
    const body: { deck: string; name?: string } = JSON.parse(String(init.body))
    if (path !== deckRoutes.rename.path) return new Response(JSON.stringify({ ok: false, refusal: "storage" }))
    sent.push(body)
    return new Response(JSON.stringify({ ok: true, deck: body.deck, name: body.name }))
  })
  return sent
}

function held(): { remote: Remote; opens: string[]; release: () => void } {
  const real = memoryRemote()
  const opens: string[] = []
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  return {
    opens,
    release: () => release(),
    remote: {
      open: async (body) => {
        opens.push(body.deck)
        await gate
        return real.open(body)
      },
      watch: (body) => real.watch(body),
      commit: (body) => real.commit(body),
    },
  }
}

it("lists a deck imported on this device that the server has not heard of, and opens and names it from Home", async () => {
  const sent = renames()
  const { remote, calls } = tracedRemote()
  await queueOriginal(imported, () => at)
  expect(await sendUnopened(remote, ["listed-deck"])).toEqual([shown])
  await expect.poll(() => calls).toEqual([`open ${imported}`])
  await expect.poll(() => sent).toEqual([{ deck: imported, name: "clean" }])
  expect(await sendUnopened(remote, [])).toEqual([])
})

it("keeps the deck on Home while its open cannot reach the server", async () => {
  renames()
  const offline: Remote = {
    ...memoryRemote(),
    open: () => Promise.reject(new TypeError("offline")),
  }
  await queueOriginal(imported, () => at)
  expect(await sendUnopened(offline, [])).toEqual([shown])
  expect(await sendUnopened(offline, [])).toEqual([shown])
})

it("stops listing a deck once the server lists it or refuses its open", async () => {
  renames()
  const { remote, calls } = tracedRemote()
  await queueOriginal(imported, () => at)
  expect(await sendUnopened(remote, [imported])).toEqual([])
  expect(await sendUnopened(remote, [])).toEqual([])
  expect(calls).toEqual([])
  await queueOriginal(imported, () => at)
  const refused = tracedRemote({ ok: false, refusal: "deleted" } as OpenResult)
  expect(await sendUnopened(refused.remote, [])).toEqual([shown])
  await expect.poll(() => sendUnopened(refused.remote, [])).toEqual([])
})

it("shows a deck imported and not opened only to the account that imported it, and sends nothing for anyone else", async () => {
  renames()
  const { remote, calls } = tracedRemote()
  await queueOriginal(imported, () => at)
  signInAs(secondAccount)
  expect(await sendUnopened(remote, [])).toEqual([])
  signInAs(undefined)
  expect(await sendUnopened(remote, [])).toEqual([])
  expect(calls).toEqual([])
  signInAs(firstAccount)
  expect(await sendUnopened(remote, [])).toEqual([shown])
})

it("sends one open for a deck that Home lists again while its open is held", async () => {
  const sent = renames()
  const { remote, opens, release } = held()
  await queueOriginal(imported, () => at)
  expect(await sendUnopened(remote, [])).toEqual([shown])
  expect(await sendUnopened(remote, [])).toEqual([shown])
  release()
  await expect.poll(() => sent).toEqual([{ deck: imported, name: "clean" }])
  expect(opens).toEqual([imported])
  expect(await sendUnopened(remote, [])).toEqual([])
})
