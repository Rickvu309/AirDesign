import type { SlideCommand } from "@airdesign/document"
import { paintStore } from "@airdesign/render"
import { expect, it, vi } from "vitest"
import type { CommitOutcome } from "@/editing/commit-edit"
import { until } from "@/replay-waits"
import { slideCommands, type CommandedDeck } from "./slide-commands"
import { storeLane } from "../editor/store-lane"
import type { DeckPaint } from "../editor/use-deck-paint"

const device = vi.hoisted(() => ({
  rows: [] as unknown[],
  seen: [] as number[],
  sends: [] as (() => void)[],
}))

vi.mock("@airdesign/live", async (original) => ({
  ...(await original<object>()),
  connect: () => ({
    openDeck: async () => ({ ok: true, register: { file: [], order: [...device.rows] as SlideCommand[] } }),
  }),
}))

vi.mock("@/editing/slide-edit", async (original) => ({
  ...(await original<object>()),
  commitSlideChange: async (
    _deck: string,
    _parts: unknown,
    register: { readonly order: readonly unknown[] },
    change: string,
    index: number,
    paint: (current: number, undoable: null) => Promise<void>,
  ): Promise<CommitOutcome> => {
    device.seen.push(register.order.length)
    await new Promise((stored) => setTimeout(stored, 1))
    device.rows.push({ change, index })
    await paint(index, null)
    await new Promise<void>((sent) => device.sends.push(sent))
    return "sent"
  },
}))

function openedDeck(): CommandedDeck {
  const shown = {
    store: { current: paintStore() },
    shownParts: { current: new Map() },
    canvases: { current: () => null },
    slideCount: 3,
    groups: [],
    current: 0,
    setCurrent: () => undefined,
    layouts: [],
    showEdited: async () => undefined,
    shownRegister: { current: null },
    saySlide: { current: () => undefined },
  } as unknown as DeckPaint
  const records = { current: { hold: () => ({ record: () => undefined, release: () => undefined }) } }
  return {
    id: "deck",
    shown,
    undo: { records, lane: storeLane(), slideLane: storeLane() } as unknown as CommandedDeck["undo"],
    settle: () => undefined,
  }
}

it("reads the deck for a slide command pressed after a render only once the command before it is stored, not once it is sent", async () => {
  const deck = openedDeck()
  slideCommands(deck).onRemove?.(0)
  slideCommands(deck).onRemove?.(0)
  await until(() => device.seen.length === 2, "the second command's read")
  expect(device.seen).toEqual([0, 1])
  await until(() => device.sends.length === 2, "the second command's send")
  for (const sent of device.sends) sent()
})
