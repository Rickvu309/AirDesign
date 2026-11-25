import * as doom from "@airdesign/doom"
import { createDoomDeck } from "../doom-deck.js"
import { memoryDoomRemote, type DoomRemote } from "../doom-remote.js"

export const frame = doom.nodeId("frame:1")
export const slide = doom.nodeId("s:3")
const at = doom.orderKeyBetween(null, null)
export const person: doom.Author = { kind: "person", id: "person" }
export const measure = doom.measureWith({})

export const data = (value: number) => ({ rows: [{ id: "a", label: "A", value }] })

export async function placed(extra: readonly doom.Write[] = []) {
  const shared = memoryDoomRemote({
    once: "start",
    author: person,
    writes: [
      { node: doom.nodeId("s:1"), prop: "type", value: "deck" },
      { node: doom.nodeId("s:1"), prop: "theme", value: doom.defaultTheme },
      { node: doom.nodeId("s:2"), prop: "type", value: "slideRow" },
      { node: doom.nodeId("s:2"), prop: "parent", value: { id: doom.nodeId("s:1"), at } },
      { node: slide, prop: "type", value: "slide" },
      { node: slide, prop: "parent", value: { id: doom.nodeId("s:2"), at } },
    ],
  })
  let offline = false
  const sent: doom.Edit[] = []
  let beforeSend: (() => Promise<void>) | undefined
  const remote: DoomRemote = {
    ...shared,
    edit: async (body) => {
      if (offline) throw new TypeError("offline")
      await beforeSend?.()
      sent.push(body.edit)
      return shared.edit(body)
    },
  }
  const first = await createDoomDeck(remote, "linked", { client: "first" })
  if (!first.ok) throw new Error(JSON.stringify(first))
  const { deck } = first
  const writes = doom.placeComponent(deck.view(), doom.columnDefinition, {
    frame,
    parent: { id: slide, at },
    box: { x: 10, y: 10, w: 1200, h: 600, rotation: 0, flipH: false, flipV: false },
    measure,
    data: data(1),
  })
  if (doom.isRefusal(writes)) throw new Error(JSON.stringify(writes))
  const pushed = deck.push([...writes, ...extra], { read: deck.view() })
  if (!pushed.ok) throw new Error(JSON.stringify(pushed))
  await deck.sync()
  const node = deck.view().nodes.get(frame)
  const bar = node?.type === "frame" && node.instance?.parts.find(({ key }) => key[0] === "bar")
  if (!bar) throw new Error("Missing bar")
  return {
    bar: bar.node,
    deck,
    sent,
    remote,
    shared,
    intercept: (next: () => Promise<void>) => {
      beforeSend = next
    },
    offline: (value: boolean) => {
      offline = value
    },
  }
}

export const two = { rows: [...data(1).rows, { id: "b", label: "B", value: 4 }] }

export function barFor(view: doom.Doom, row: string) {
  const bar = doom
    .propOf(view.nodes.get(frame), "instance")
    ?.parts.find(({ key }) => key[0] === "bar" && key[1] === row)
  if (bar === undefined) throw new Error(`Missing bar ${row}`)
  return bar.node
}

export const instance = (fold: doom.Doom): doom.Instance | undefined => doom.propOf(fold.nodes.get(frame), "instance")
export const agent = (run: string): doom.Author => ({ kind: "agent", id: "agent", run })

export async function agentUpdate(deck: string, remote: DoomRemote, fold: doom.Doom, run: string) {
  const update = doom.regenerateComponent(fold, frame, { data: two }, measure)
  if (doom.isRefusal(update)) throw new Error(JSON.stringify(update))
  const landed = await remote.edit({
    deck,
    edit: { author: agent(run), once: run, writes: update.writes, readBase: fold.rev, phase: "start" },
  })
  if (!landed.ok) throw new Error(JSON.stringify(landed))
}
