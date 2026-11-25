import * as doom from "@airdesign/doom"
import { expect, it, vi } from "vitest"
import { nudge, retyped, slide, start, tabs, title, typed, xOf } from "./testing/offline-tabs.js"

async function waitingTurns(count: number) {
  const pair = await tabs(start)
  const { cut, mine, theirs } = pair
  expect(mine.push([...typed, ...nudge(1)]).ok).toBe(true)
  expect(await mine.sync()).toEqual({ ok: true })
  cut.off = true
  for (let i = 0; i < count; i++) expect((i % 2 === 0 ? mine.undo() : mine.redo()).ok).toBe(true)
  expect(await mine.sync()).toEqual({ ok: false, reason: "offline" })
  expect(mine.pending()).toHaveLength(count)
  await theirs.catchUp()
  expect(theirs.push([retyped]).ok).toBe(true)
  expect(await theirs.sync()).toEqual({ ok: true })
  expect(theirs.server().rev).toBe(3)
  return pair
}

it("rebuilds fifty dependent turns in bounded tasks when another tab changed one property", async () => {
  const { cut, mine } = await waitingTurns(50)

  const apply = vi.spyOn(doom, "applyEdit")
  const now = vi.spyOn(performance, "now").mockImplementation(() => apply.mock.calls.length * 2)
  const callsPerTask: number[] = []
  let last = 0
  const record = () => {
    const calls = apply.mock.calls.length
    callsPerTask.push(calls - last)
    last = calls
  }
  const timer = setInterval(record, 0)
  const stop = mine.subscribe(() => {
    if (mine.server().rev === 3 && mine.pending()[0]?.writes.length === 1) {
      record()
      clearInterval(timer)
      const folded = apply.mock.calls.length
      mine.view()
      expect(apply.mock.calls).toHaveLength(folded)
    }
  })
  try {
    cut.off = false
    expect(await mine.sync()).toEqual({ ok: true })
    expect(callsPerTask.length).toBeGreaterThan(1)
    expect(apply.mock.calls.length).toBeLessThanOrEqual(50 * 4)
    expect(Math.max(...callsPerTask)).toBeLessThanOrEqual(25)
  } finally {
    stop()
    clearInterval(timer)
    now.mockRestore()
    apply.mockRestore()
  }
  expect(mine.notices()).toEqual([])
  expect(mine.pending()).toEqual([])
  expect(mine.server().rev).toBe(53)
  expect(doom.propOf(mine.server().nodes.get(title), "text")?.chars).toBe("Theirs")
  expect(xOf(mine.server())).toBe(1)
  expect(mine.view()).toBe(mine.server())
})

it("keeps an edit painted during a replay slice and sends it after the rebuilt turns", async () => {
  const { cut, mine } = await waitingTurns(10)
  const apply = vi.spyOn(doom, "applyEdit")
  const now = vi.spyOn(performance, "now").mockImplementation(() => apply.mock.calls.length * 2)
  try {
    const first = mine.pending()[0]
    const between = new Promise<void>((resolve) => setTimeout(resolve, 0)).then(() => {
      expect(mine.server().rev).toBe(3)
      expect(mine.status()).toEqual({ kind: "saving" })
      expect(mine.pending()[0]).toBe(first)
      expect(mine.push([{ node: slide, prop: "name", value: "During replay" }]).ok).toBe(true)
      expect(doom.propOf(mine.view().nodes.get(slide), "name")).toBe("During replay")
    })
    cut.off = false
    const synced = mine.sync()
    await between
    expect(await synced).toEqual({ ok: true })
  } finally {
    now.mockRestore()
    apply.mockRestore()
  }
  expect(mine.pending()).toEqual([])
  expect(mine.notices()).toEqual([])
  expect(mine.server().rev).toBe(14)
  expect(doom.propOf(mine.server().nodes.get(slide), "name")).toBe("During replay")
  expect(doom.propOf(mine.server().nodes.get(title), "text")?.chars).toBe("Theirs")
  expect(xOf(mine.server())).toBe(1)
})

it("keeps the original queue until it can rebuild on the latest server fold", async () => {
  const { cut, mine, theirs, inFlight } = await waitingTurns(10)
  const apply = vi.spyOn(doom, "applyEdit")
  const now = vi.spyOn(performance, "now").mockImplementation(() => apply.mock.calls.length * 2)
  const head = mine.pending()[0]
  const atRetry = vi.fn()
  const during = new Promise<void>((resolve) => setTimeout(resolve, 0)).then(async () => {
    expect(mine.server().rev).toBe(3)
    expect(theirs.push(nudge(5)).ok).toBe(true)
    expect(await theirs.sync()).toEqual({ ok: true })
    await mine.catchUp()
    expect(mine.server().rev).toBe(4)
    inFlight.before = async () => atRetry(mine.pending()[0])
  })
  cut.off = false
  const synced = mine.sync()
  try {
    await during
    expect(await synced).toEqual({ ok: true })
    expect(atRetry).toHaveBeenCalledOnce()
    expect(atRetry.mock.calls[0]?.[0]).toBe(head)
  } finally {
    now.mockRestore()
    apply.mockRestore()
  }
  expect(mine.pending()).toEqual([])
  expect(mine.server().rev).toBe(4)
  expect(xOf(mine.view())).toBe(5)
})

it("stops sending if the deck is removed during a replay slice", async () => {
  const { cut, mine, remote, inFlight } = await waitingTurns(10)
  const apply = vi.spyOn(doom, "applyEdit")
  const now = vi.spyOn(performance, "now").mockImplementation(() => apply.mock.calls.length * 2)
  const sent = vi.fn(async () => undefined)
  const during = new Promise<void>((resolve) => setTimeout(resolve, 0)).then(async () => {
    expect(mine.server().rev).toBe(3)
    const since = vi.spyOn(remote, "since").mockResolvedValueOnce({ ok: false, refusal: "deck" })
    try {
      expect(await mine.follow(new AbortController().signal)).toBe("gone")
    } finally {
      since.mockRestore()
    }
    inFlight.before = sent
    inFlight.answer = { ok: false, refusal: "deck" }
  })
  cut.off = false
  const synced = mine.sync()
  try {
    await during
    expect(await synced).toEqual({ ok: false, reason: "blocked", refusal: "deck" })
    expect(sent).not.toHaveBeenCalled()
  } finally {
    now.mockRestore()
    apply.mockRestore()
  }
})
