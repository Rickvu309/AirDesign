import * as doom from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { editingNow, editingWindow, heardWrites, quietIn } from "./editing-now"
import { testTheme } from "@airdesign/doom/testing"

const grown = doom.doomFromTree({
  theme: testTheme,
  slides: [{ children: [{ type: "shape", name: "Title" }] }],
})
const layer = grown.doom.children.get(grown.slides[0]!)![0]!
const claude = (name?: string): doom.Author => ({ kind: "agent", id: "claude", run: "c1", ...(name ? { name } : {}) })

function landed(fold: doom.Doom, edit: doom.Edit): doom.Doom {
  const next = doom.applyEdit(fold, { ...edit, rev: doom.rev(fold.rev + 1) })
  if (doom.isRefusal(next)) throw new Error(next.refused)
  return next
}

const write = (fold: doom.Doom, value: string, phase?: "start") =>
  landed(fold, {
    once: value,
    author: claude(phase === undefined ? undefined : "Claude Code"),
    writes: [{ node: layer, prop: "name", value }],
    ...(phase === undefined ? {} : { phase }),
  })

describe("which agents are editing now", () => {
  it("counts a run as editing for thirty seconds after a write this tab saw, while the run stays open", () => {
    const open = grown.doom
    let heard = heardWrites(new Map(), open, 0, true)
    const started = write(open, "A", "start")
    heard = heardWrites(heard, started, 1_000, false)
    expect(editingNow(heard, 1_000 + editingWindow - 1)).toEqual(new Set(["c1"]))
    expect(editingNow(heard, 1_000 + editingWindow)).toEqual(new Set())
    expect(started.runs.get("c1")?.phase).toBe("running")
    expect(quietIn(heard, 11_000)).toBe(editingWindow - 10_000)
  })

  it("starts the thirty seconds again at a late write into the same run", () => {
    const started = write(grown.doom, "A", "start")
    let heard = heardWrites(heardWrites(new Map(), grown.doom, 0, true), started, 0, false)
    const late = write(started, "B")
    heard = heardWrites(heard, late, 300_000, false)
    expect(editingNow(heard, 300_000 + 1_000)).toEqual(new Set(["c1"]))
  })

  it("keeps what it heard when no run wrote since", () => {
    const started = write(grown.doom, "A", "start")
    const heard = heardWrites(heardWrites(new Map(), grown.doom, 0, true), started, 0, false)
    expect(heardWrites(heard, started, 5_000, false)).toBe(heard)
  })

  it("does not call a run that was already open when the tab opened editing until it writes again", () => {
    const started = write(grown.doom, "A", "start")
    const heard = heardWrites(new Map(), started, 5_000, true)
    expect(editingNow(heard, 5_000)).toEqual(new Set())
    expect(quietIn(heard, 5_000)).toBeUndefined()
    expect(editingNow(heardWrites(heard, write(started, "B"), 6_000, false), 6_000)).toEqual(new Set(["c1"]))
  })
})
