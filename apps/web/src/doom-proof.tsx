import { doom } from "@airdesign/document"
import {
  createDoomDeck,
  httpDoomRemote,
  memoryDoomRemote,
  openDoomDeck,
  type DoomDeck,
  type DoomRemote,
} from "@airdesign/live"

const session: { remote: DoomRemote } = { remote: httpDoomRemote() }
const held = new Map<string, DoomDeck>()
const stops = new Map<string, AbortController>()

async function hold(how: typeof createDoomDeck, deck: string) {
  const opened = await how(session.remote, deck)
  if (opened.ok) held.set(deck, opened.deck)
  return opened.ok ? { ok: true } : opened
}

function heldDeck(deck: string): DoomDeck {
  const found = held.get(deck)
  if (found === undefined) throw new Error("no doom deck held")
  return found
}

const airdesignDoom = {
  memoryDoomRemote,
  useRemote(remote: DoomRemote) {
    session.remote = remote
  },
  create: (deck: string) => hold(createDoomDeck, deck),
  open: (deck: string) => hold(openDoomDeck, deck),
  deck: heldDeck,
  view: (deck: string) => doom.foldToJson(heldDeck(deck).view()),
  server: (deck: string) => doom.foldToJson(heldDeck(deck).server()),
  follow(deck: string) {
    const stop = new AbortController()
    stops.set(deck, stop)
    void heldDeck(deck).follow(stop.signal)
  },
  unfollow(deck: string) {
    stops.get(deck)?.abort()
    stops.delete(deck)
  },
}

Object.assign(globalThis, { airdesignDoom })

export function DoomProof() {
  return <main />
}
