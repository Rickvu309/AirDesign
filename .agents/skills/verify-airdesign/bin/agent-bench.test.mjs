import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { deckDiff } from "../../../../packages/pptx/src/index.ts"
import { chosenTasks, deckPath, tasksFile } from "./agent-bench.mjs"
import {
  compareRuns,
  families,
  interval,
  newFaults,
  passed,
  shown,
  summarize,
  untouched,
  wantKinds,
  wantsOf,
} from "./agent-bench-score.mjs"

const bytes = (text) => new TextEncoder().encode(text)
const slideParts = ["ppt/slides/slide1.xml", "ppt/slides/slide2.xml", "ppt/slides/slide3.xml"]
const original = new Map([
  ["[Content_Types].xml", bytes("<Types/>")],
  ["ppt/presentation.xml", bytes("<p:presentation/>")],
  ...slideParts.map((part, index) => [part, bytes(`<p:sld>${String(index + 1)}</p:sld>`)]),
])

function paragraph(text) {
  return { runs: [{ text }] }
}

function slide(texts, extra = {}) {
  return {
    elements: texts.map((text, index) => ({
      node: `${String(index + 2)}`,
      from: "slide",
      placeholder: index === 0 ? "title" : null,
      text: { paragraphs: [paragraph(text)] },
      cells: null,
    })),
    ...extra,
  }
}

const task = {
  id: "fix-overflow-test-2",
  family: "fix overflow",
  may: { slides: [2] },
  want: [{ kind: "finding-gone", slide: 2, code: "overflow" }, { kind: "no-new-findings" }],
  limit: { calls: 10, seconds: 60 },
}

describe("untouched", () => {
  it("a trial that changed a part outside may fails with the part named", () => {
    const exported = new Map(original)
    exported.set("ppt/slides/slide2.xml", bytes("<p:sld>2 fixed</p:sld>"))
    exported.set("ppt/slides/slide1.xml", bytes("<p:sld>1 touched</p:sld>"))
    const found = deckDiff(original, exported)
    expect(untouched(found, task.may, slideParts)).toEqual({
      ok: false,
      changed: ["ppt/slides/slide1.xml", "ppt/slides/slide2.xml"],
      outside: ["ppt/slides/slide1.xml"],
    })
    exported.set("ppt/slides/slide1.xml", original.get("ppt/slides/slide1.xml"))
    expect(untouched(deckDiff(original, exported), task.may, slideParts).ok).toBe(true)
  })

  it("new slides may add parts and change only the deck's own list of slides", () => {
    const exported = new Map(original)
    exported.set("ppt/slides/slide4.xml", bytes("<p:sld>4</p:sld>"))
    exported.set("ppt/presentation.xml", bytes("<p:presentation>4</p:presentation>"))
    expect(untouched(deckDiff(original, exported), { slides: "new" }, slideParts).ok).toBe(true)
    exported.set("ppt/slides/slide3.xml", bytes("<p:sld>3 touched</p:sld>"))
    expect(untouched(deckDiff(original, exported), { slides: "new" }, slideParts).outside).toEqual([
      "ppt/slides/slide3.xml",
    ])
  })
})

describe("finding-gone", () => {
  const overflow = { slide: 2, node: "4", code: "overflow" }
  const deck = (before, after) => ({
    before: { slides: [], faults: before, xml: [] },
    after: { slides: [], faults: after, xml: [] },
  })

  it("holds only when the slide's overflow is gone and no new finding appeared", () => {
    const [gone] = wantsOf(task, deck([overflow], []))
    expect(gone).toMatchObject({ kind: "finding-gone", ok: true })
    const [kept] = wantsOf(task, deck([overflow], [overflow]))
    expect(kept).toMatchObject({ ok: false, left: 1 })
    const covering = { slide: 2, node: "5", code: "overlap" }
    const [traded] = wantsOf(task, deck([overflow], [covering]))
    expect(traded).toMatchObject({ ok: false, appeared: [covering] })
    const [never] = wantsOf(task, deck([], []))
    expect(never).toMatchObject({ ok: false, had: false })
  })

  it("counts a finding as new by slide, node and code", () => {
    expect(newFaults([overflow], [overflow, { ...overflow, code: "small-text" }])).toEqual([
      { ...overflow, code: "small-text" },
    ])
  })
})

describe("text and shape wants", () => {
  const deck = (before, after, xml = []) => ({
    before: { slides: before, faults: [], xml: [] },
    after: { slides: after, faults: [], xml },
  })

  it("text-kept names each paragraph that left the slide", () => {
    const kept = { id: "t", want: [{ kind: "text-kept", slides: [1] }] }
    const [result] = wantsOf(kept, deck([slide(["Plan", "Lessons learned", "Costs"])], [slide(["Plan", "Costs"])]))
    expect(result).toEqual({ kind: "text-kept", ok: false, missing: ["Lessons learned"] })
  })

  it("script counts the share of words written in that script", () => {
    const translated = { id: "t", want: [{ kind: "script", slides: [1], script: "Latin-vi" }] }
    const vietnamese = slide(["Kế hoạch năm tới", "Chi phí và rủi ro"])
    expect(wantsOf(translated, deck([], [vietnamese]))[0]).toMatchObject({ ok: true })
    expect(wantsOf(translated, deck([], [slide(["Next year plan"])]))[0]).toMatchObject({ ok: false, share: 0 })
  })

  it("text-has holds when the slide's text carries the words", () => {
    const dated = { id: "t", want: [{ kind: "text-has", slide: 1, text: "June 2027" }] }
    expect(wantsOf(dated, deck([], [slide(["Review", "June  2027"])]))[0]).toEqual({ kind: "text-has", ok: true })
    expect(wantsOf(dated, deck([], [slide(["Review", "June 2026"])]))[0].ok).toBe(false)
  })

  it("text-changed holds inside the length ratio and fails when the text stayed", () => {
    const changed = { id: "t", want: [{ kind: "text-changed", slides: [1], lengthRatio: [0.6, 2] }] }
    expect(wantsOf(changed, deck([slide(["Next year"])], [slide(["Năm tới nữa"])]))[0].ok).toBe(true)
    expect(wantsOf(changed, deck([slide(["Next year"])], [slide(["Next year"])]))[0].ok).toBe(false)
  })

  it("slides-added wants the count and a title on each new slide", () => {
    const added = { id: "t", want: [{ kind: "slides-added", count: 2 }] }
    const first = slide(["Intro"])
    expect(wantsOf(added, deck([first], [first, slide(["One"]), slide(["Two"])]))[0].ok).toBe(true)
    const bare = { elements: [] }
    expect(wantsOf(added, deck([first], [first, slide(["One"]), bare]))[0]).toMatchObject({ ok: false, untitled: [3] })
  })

  it("joined counts the shapes connectors bind, and theme-colors finds a fixed colour", () => {
    const connector = (from, to) =>
      `<p:cxnSp><p:nvCxnSpPr><p:cNvCxnSpPr><a:stCxn id="${from}" idx="3"/><a:endCxn id="${to}" idx="1"/></p:cNvCxnSpPr></p:nvCxnSpPr></p:cxnSp>`
    const xml = [`<p:sld>${connector(4, 5)}${connector(5, 6)}<a:srgbClr val="FF0000"/></p:sld>`]
    const shapes = {
      id: "t",
      want: [
        { kind: "joined", slide: 1, shapes: 3 },
        { kind: "theme-colors", slides: [1] },
      ],
    }
    expect(wantsOf(shapes, deck([], [], xml))).toEqual([
      { kind: "joined", ok: true, bound: 3 },
      { kind: "theme-colors", ok: false, fixed: [1] },
    ])
  })
})

describe("passed", () => {
  const clean = {
    wants: [{ ok: true }],
    untouched: { ok: true },
    validator: { ok: true },
    calls: 4,
    seconds: 30,
    stopped: false,
  }

  it("passes inside the limit and fails past it or with a validator error", () => {
    expect(passed(clean, task)).toBe(true)
    expect(passed({ ...clean, calls: 11 }, task)).toBe(false)
    expect(passed({ ...clean, validator: { ok: false } }, task)).toBe(false)
    expect(passed({ ...clean, untouched: { ok: false } }, task)).toBe(false)
  })
})

function summary(tasks, pass, extra = {}) {
  return {
    tasks,
    model: "claude-sonnet-5-5",
    effort: "low",
    commit: "2c036f24aa",
    ...extra,
    perTask: Object.fromEntries(
      pass.map((share, index) => [
        `task-${String(index)}`,
        {
          family: index % 2 === 0 ? "translate" : "fix overflow",
          hash: `h${String(index)}`,
          trials: 3,
          pass: share,
          calls: 6,
          tokens: 40_000,
          seconds: 40,
        },
      ]),
    ),
  }
}

describe("summarize", () => {
  it("gives each task its pass share and median calls, tokens and seconds", () => {
    const tokens = (input) => ({ input, read: 0, write: 0, output: 0 })
    const results = [
      { task: task.id, passed: true, calls: 4, tokens: tokens(100), seconds: 30 },
      { task: task.id, passed: false, calls: 9, tokens: tokens(300), seconds: 90 },
      { task: task.id, passed: true, calls: 5, tokens: tokens(200), seconds: 40 },
    ]
    const summary = summarize({ results, tasks: [task], run: { model: "claude-sonnet-5-5", effort: "low" } })
    expect(summary.perTask[task.id]).toMatchObject({
      family: "fix overflow",
      trials: 3,
      calls: 5,
      tokens: 200,
      seconds: 40,
    })
    expect(summary.perTask[task.id].pass).toBeCloseTo(2 / 3)
  })
})

describe("compare", () => {
  it("compare refuses two runs with different task hashes", () => {
    const refused = compareRuns(summary("sha256:a", [1, 0]), summary("sha256:b", [1, 0]))
    expect(refused).toMatchObject({ ok: false, refusal: "tasks" })
    const edited = summary("sha256:a", [1, 0])
    edited.perTask["task-1"].hash = "changed"
    expect(compareRuns(summary("sha256:a", [1, 0]), edited)).toMatchObject({ ok: false, changed: ["task-1"] })
  })

  it("an interval that includes 0 says not shown", () => {
    const found = interval([1 / 3, -1 / 3, 0, 2 / 3, -2 / 3, 0])
    expect(found.low).toBeLessThan(0)
    expect(found.high).toBeGreaterThan(0)
    expect(shown(found, "more", "less")).toBe("not shown")
    expect(shown({ low: 0.05, high: 0.3 }, "more", "less")).toBe("more")
    expect(shown({ low: -0.3, high: -0.01 }, "more", "less")).toBe("less")
  })

  it("a gain on every task is shown, and the report reads the medium run as the second", () => {
    const low = summary(
      "sha256:a",
      Array.from({ length: 30 }, () => 1 / 3),
    )
    const medium = summary(
      "sha256:a",
      Array.from({ length: 30 }, () => 1),
      { effort: "medium" },
    )
    const compared = compareRuns(low, medium)
    expect(compared.verdicts.pass).toBe("medium passes more")
    expect(compared.verdicts.tokens).toBe("not shown")
    expect(compared.lines[1]).toBe(
      "pass         33 %  vs  100 %   difference +67 points, 95 % interval +67 to +67: medium passes more",
    )
  })
})

describe("agent-tasks.json", () => {
  const tasks = JSON.parse(readFileSync(tasksFile, "utf8"))
  const repo = path.resolve(import.meta.dirname, "../../../..")

  it("names each task once, with a deck in the fixtures, a known family and known wants inside may", () => {
    expect(new Set(tasks.map((task) => task.id)).size).toBe(tasks.length)
    for (const task of tasks) {
      expect(() => deckPath(repo, task.deck), task.id).not.toThrow()
      expect(families, task.id).toContain(task.family)
      expect(task.prompt.length, task.id).toBeGreaterThan(10)
      expect(task.limit.calls, task.id).toBeGreaterThan(0)
      expect(task.limit.seconds, task.id).toBeGreaterThan(0)
      for (const want of task.want) {
        expect(wantKinds, task.id).toContain(want.kind)
        const slides = [...(want.slides ?? []), ...(want.slide === undefined ? [] : [want.slide])]
        if (Array.isArray(task.may.slides))
          for (const slide of slides) expect(task.may.slides, task.id).toContain(slide)
      }
    }
  })

  it("holds thirty tasks, five in each of the six families, each family on at least three decks", () => {
    expect(tasks).toHaveLength(30)
    for (const family of families) {
      const inside = tasks.filter((task) => task.family === family)
      expect(inside, family).toHaveLength(5)
      expect(new Set(inside.map((task) => task.deck)).size, family).toBeGreaterThanOrEqual(3)
    }
  })

  it("chooses tasks by a comma list of globs", () => {
    expect(chosenTasks(tasks, "overflow-r*,notes-doe-3").map((task) => task.id)).toEqual([
      "overflow-roman-3",
      "notes-doe-3",
    ])
    expect(() => chosenTasks(tasks, "nothing-*")).toThrow("no task matches nothing-*")
  })
})
