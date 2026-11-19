import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { trial } from "../bin/agent-bench.mjs"

const task = {
  id: "recorded-add-slide",
  family: "slides from notes",
  deck: "blank.pptx",
  prompt: "Add a slide and title it Hello from Aira",
  may: { slides: "new" },
  want: [{ kind: "slides-added", count: 1 }, { kind: "no-new-findings" }],
  limit: { calls: 5, seconds: 60 },
}

function streams(kit, alsoSlideOne) {
  return async ({ deck, cookie }) => {
    const base = Number((await kit.post(kit.deckRoutes.open, { deck }, cookie)).json.revision)
    kit.aira([
      { name: "add-slide.sse", fill: { deck, base: String(base) } },
      { name: "title-slide.sse", fill: { deck, base: String(base + 1), node: "257.2" } },
      ...(alsoSlideOne ? [{ name: "title-slide.sse", fill: { deck, base: String(base + 2), node: "256.2" } }] : []),
      { name: "edited.sse" },
    ])
  }
}

export default async function drive(kit) {
  const { expect, note, page, deckRoutes } = kit
  await page.route(
    (url) => url.pathname === deckRoutes.index.path,
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500))
      await route.fallback()
    },
  )
  const out = mkdtempSync(path.join(os.tmpdir(), "agent-bench-recorded-"))
  try {
    const done = await trial(kit, task, { out, validate: null, opened: streams(kit, false) })
    expect(done.untouched).toMatchObject({ ok: true, outside: [] })
    expect(done.wants).toEqual([
      expect.objectContaining({ kind: "slides-added", ok: true, added: 1 }),
      expect.objectContaining({ kind: "no-new-findings", ok: true }),
    ])
    expect(done).toMatchObject({ passed: true, calls: 3, stopped: false })
    expect(done.tokens.input).toBeGreaterThan(0)
    note(
      `a recorded run that adds and titles one slide passes: ${String(done.calls)} calls, ${JSON.stringify(done.tokens)} tokens, changed ${done.untouched.changed.join(", ")}`,
    )
    const strayed = await trial(kit, task, { out, validate: null, number: 2, opened: streams(kit, true) })
    expect(strayed.untouched).toMatchObject({ ok: false, outside: ["ppt/slides/slide1.xml"] })
    expect(strayed.passed).toBe(false)
    note("the same run that also edits slide 1 fails on untouched, naming ppt/slides/slide1.xml")
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
}
