import { scene } from "@airdesign/document"
import {
  createSceneDeck,
  httpSceneRemote,
  memorySceneRemote,
  openSceneDeck,
  type SceneDeck,
  type SceneRemote,
} from "@airdesign/live"

const session: { remote: SceneRemote } = { remote: httpSceneRemote() }
const held = new Map<string, SceneDeck>()
const stops = new Map<string, AbortController>()

async function hold(how: typeof createSceneDeck, deck: string) {
  const opened = await how(session.remote, deck)
  if (opened.ok) held.set(deck, opened.deck)
  return opened.ok ? { ok: true } : opened
}

function heldDeck(deck: string): SceneDeck {
  const found = held.get(deck)
  if (found === undefined) throw new Error("no scene deck held")
  return found
}

const airdesignScene = {
  memorySceneRemote,
  useRemote(remote: SceneRemote) {
    session.remote = remote
  },
  create: (deck: string) => hold(createSceneDeck, deck),
  open: (deck: string) => hold(openSceneDeck, deck),
  deck: heldDeck,
  view: (deck: string) => scene.foldToJson(heldDeck(deck).view()),
  server: (deck: string) => scene.foldToJson(heldDeck(deck).server()),
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

Object.assign(globalThis, { airdesignScene })

export function SceneProof() {
  return <main />
}
