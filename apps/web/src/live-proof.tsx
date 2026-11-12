import { readElementId } from "@airdesign/document"
import {
  accountKey,
  connect,
  databaseName,
  getPart,
  httpRemote,
  memoryRemote,
  putPart,
  rowKey,
  scoped,
  storeName,
  type Remote,
} from "@airdesign/live"

const session: { remote: Remote } = { remote: memoryRemote() }

function cache() {
  return connect(session.remote)
}

const airdesignLive = {
  memoryRemote,
  httpRemote,
  putPart,
  getPart,
  rowKey: (deck: string, kind: "confirmed" | "pending", number: number) =>
    scoped(accountKey() ?? "", rowKey(deck, kind, number)),
  database: databaseName,
  store: storeName,
  useRemote(remote: Remote) {
    session.remote = remote
  },
  enqueue(deck: string, value: string, node: string, floor = "") {
    const id = readElementId(node)
    if (id === undefined) return Promise.resolve({ ok: false, refusal: "node" })
    return cache().enqueue(deck, value, id, floor)
  },
  pending(deck: string) {
    return cache().pending(deck)
  },
  flush(deck: string) {
    return cache().flush(deck)
  },
  openDeck(deck: string) {
    return cache().openDeck(deck)
  },
  phase(deck: string) {
    return cache().phase(deck)
  },
}

Object.assign(globalThis, { airdesignLive })

export function LiveProof() {
  return <main />
}
