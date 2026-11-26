import { scriptOf } from "@airdesign/mcp/testing/evals"
import { catalog, projectTools } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import { callTool, emptyLog, type DeckHost, type Session } from "@airdesign/mcp"
import { memoryDecks } from "@airdesign/mcp/testing/evals"
import { expect, it } from "vitest"
import { FontMetrics } from "../platform/font-metrics.js"
import { FontSource } from "../platform/font-source.js"

const names = Object.fromEntries(projectTools(catalog).map((tool) => [tool.op, tool.name])) as Record<string, string>
const family = "Liberation Sans Narrow"
const local = new FontSource(undefined)
const metrics = new FontMetrics({
  family: (name) => local.family(name === "Geist" || name === family ? name : "AirDesign Missing Face"),
  file: (name, file) => local.file(name, file),
})
const spot = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, rotation: 0, flipH: false, flipV: false })
const hugging = { w: "hug", h: "hug" } as const
const line = (chars: string, style: "title" | "body", font?: string) => {
  const text = doom.textFromMarkdown(chars, style)
  return {
    ...text,
    spans: font === undefined ? text.spans : [{ end: chars.length, font }],
    resize: "widthAndHeight" as const,
  }
}
const flow = (mode: "row" | "column", gap: number, pad: number) => ({
  mode,
  gap,
  padding: { t: pad, r: pad, b: pad, l: pad },
  align: "top-left" as const,
})
const words = (name: string, chars: string, font?: string) => ({
  type: "shape" as const,
  name,
  props: { box: spot(0, 0, 1, 1), text: line(chars, "body", font), sizing: hugging },
})

const grown = (
  row: readonly ReturnType<typeof words>[],
  elsewhere: readonly ReturnType<typeof words>[] = [],
  siblings: readonly ReturnType<typeof words>[] = [],
) =>
  doom.doomFromTree({
    theme: { ...doom.defaultTheme, fonts: { heading: family, body: family } },
    slides: [
      {
        children: [
          {
            type: "frame",
            name: "outer",
            props: { box: spot(120, 90, 1, 1), layout: flow("column", 24, 40), sizing: hugging },
            children: [
              {
                type: "shape",
                name: "headline",
                props: { box: spot(0, 0, 1, 1), text: line("Revenue grew 12% to $48.2M", "title"), sizing: hugging },
              },
              {
                type: "frame",
                name: "inner",
                props: { box: spot(0, 0, 1, 1), layout: flow("row", 16, 12), sizing: hugging },
                children: row,
              },
              ...siblings,
            ],
          },
          ...elsewhere,
        ],
      },
    ],
  })

const sameWithin = (left: doom.Box | undefined, right: doom.Box | undefined, tolerance: number) =>
  left !== undefined &&
  right !== undefined &&
  (["x", "y", "w", "h"] as const).every((side) => Math.abs(left[side] - right[side]) <= tolerance)

async function agentBakes(
  made: ReturnType<typeof grown>,
  frame: string,
  measure: DeckHost["measure"],
  changes: readonly unknown[] = [{ op: "set", target: made.ids[frame], layout: "none" }],
  pendingFonts?: ReadonlySet<string>,
) {
  const decks = memoryDecks(() => made.doom)
  const host = { ...decks, ...(measure === undefined ? {} : { measure }) }
  const session: Session = { agent: "aira", mint: () => "m", log: emptyLog(), now: 0 }
  const call = (op: string, args: unknown) => {
    session.once = `call-${op}`
    return callTool(names[op]!, args, session, host, pendingFonts)
  }
  const { deck } = (await call("create_deck", {})).answer as { deck: string }
  const before = decks.decks.get(deck as never)!
  const landed = await call("execute", {
    deck,
    script: scriptOf(changes),
  })
  return { answer: landed.answer, before, saved: decks.decks.get(deck as never)! }
}

const kids = ["outer", "headline", "inner", "left", "right"]
const settled = (made: ReturnType<typeof grown>, view: doom.Doom, measure: doom.Measure) => {
  const boxes = doom.solveLayout(view, made.slides[0]!, measure)
  return kids.map((name) => boxes.get(made.ids[name]!))
}

it("bakes an agent's layout none to the boxes the painter's bake gives, with the served font widths", async () => {
  const made = grown([words("left", "Wiggle waves AVAVA"), words("right", "illi MMMM ... WWW")])
  const read = await metrics.measure([made.doom])
  if (typeof read === "string") throw new Error(read)
  const person = doom.bakeLayout(made.doom, made.ids.outer!, read.measure)
  const byPerson = settled(
    made,
    doom.viewOf(made.doom, [{ once: "person", author: { kind: "person", id: "p" }, writes: person }]),
    read.measure,
  )
  const { answer, saved } = await agentBakes(made, "outer", (folds, layers) =>
    metrics.measure(folds, undefined, layers),
  )
  expect(answer).toMatchObject({ ok: true })
  const byAgent = settled(made, saved, read.measure)
  const estimated = doom.solveLayout(made.doom, made.slides[0]!, doom.measureWith({}))
  expect(sameWithin(estimated.get(made.ids.right!), byPerson[4], 0.5)).toBe(false)
  for (const [at, box] of byPerson.entries()) expect(sameWithin(byAgent[at], box, 0.5), kids[at]).toBe(true)
})

it("bakes the same boxes with a typeface no one serves elsewhere on the slide", async () => {
  const row = [words("left", "Wiggle waves AVAVA"), words("right", "illi MMMM ... WWW")]
  const plain = await agentBakes(grown(row), "outer", (folds, layers) => metrics.measure(folds, undefined, layers))
  const made = grown(row, [words("elsewhere", "Unlisted typeface elsewhere", "AirDesign Missing Face")])
  const { answer, saved } = await agentBakes(made, "outer", (folds, layers) =>
    metrics.measure(folds, undefined, layers),
  )
  expect(answer).toMatchObject({ ok: true })
  for (const name of kids)
    expect(doom.propOf(saved.nodes.get(made.ids[name]!), "box"), name).toEqual(
      doom.propOf(plain.saved.nodes.get(made.ids[name]!), "box"),
    )
})

it("refuses a layout none whose words only a system font would paint, naming those layers and letters", async () => {
  const made = grown([words("left", "Revenue 収益"), words("right", "増加 12%")])
  const { answer, saved } = await agentBakes(made, "inner", (folds, layers) =>
    metrics.measure(folds, undefined, layers),
  )
  expect(answer).toMatchObject({ ok: false, refusal: "fonts", layers: [made.ids.left, made.ids.right] })
  expect([...String(answer.characters)].sort()).toEqual([..."収益増加"].sort())
  expect(doom.propOf(saved.nodes.get(made.ids.inner!), "layout")?.mode).toBe("row")
})

it("bakes when the shared measure agrees within half a pixel, even with a legacy coverage gap", async () => {
  const made = grown([words("left", "収益"), words("right", "Next")])
  const measure = doom.measureWith({})
  const missing = new Map([[doom.fontFace(family, false, false), new Set("収益")]])
  for (const difference of [0.5, 0.51]) {
    const { answer } = await agentBakes(made, "inner", async () => ({
      measure,
      missing,
      shared: async () => (text, theme, width, fit) => {
        const result = measure(text, theme, width, fit)
        return text.chars === "収益" ? { ...result, w: result.w + difference } : result
      },
    }))
    expect(answer.ok, String(difference)).toBe(difference <= 0.5)
  }
})

it("refuses a layout none it cannot measure in time, rather than bake estimated widths", async () => {
  const made = grown([words("left", "Wiggle waves AVAVA"), words("right", "illi MMMM ... WWW")])
  for (const measure of [async () => "time" as const, undefined]) {
    const { answer, saved } = await agentBakes(made, "outer", measure)
    expect(answer).toMatchObject({ ok: false, refusal: "fonts" })
    expect(doom.propOf(saved.nodes.get(made.ids.outer!), "layout")?.mode).toBe("column")
  }
})

it("refuses text that is only present at the bake, without landing any of the batch", async () => {
  const made = grown([words("left", "Revenue"), words("right", "Next")])
  const { answer, before, saved } = await agentBakes(
    made,
    "inner",
    (folds, layers) => metrics.measure(folds, undefined, layers),
    [
      { op: "set", target: made.ids.left, text: "収益" },
      { op: "set", target: made.ids.inner, layout: "none" },
      { op: "set", target: made.ids.left, text: "Revenue" },
    ],
  )
  expect(answer).toMatchObject({ ok: false, refusal: "fonts", layers: [made.ids.left], characters: "収益" })
  expect(saved).toEqual(before)
})

it("bakes when an earlier change fixes the text and an unrelated layer still lacks glyphs", async () => {
  const made = grown([words("left", "収益"), words("right", "Next")], [words("elsewhere", "収益")])
  const { answer, saved } = await agentBakes(
    made,
    "inner",
    (folds, layers) => metrics.measure(folds, undefined, layers),
    [
      { op: "set", target: made.ids.left, text: "Revenue" },
      { op: "set", target: made.ids.inner, layout: "none" },
    ],
  )
  expect(answer).toMatchObject({ ok: true })
  expect(doom.propOf(saved.nodes.get(made.ids.inner!), "layout")?.mode).toBe("none")
})

it("ignores the same glyph when it is uncovered only in a different face outside the bake", async () => {
  const made = grown([words("left", "β"), words("right", "Next")], [words("elsewhere", "β", "Geist")])
  const { answer, saved } = await agentBakes(made, "inner", (folds, layers) =>
    metrics.measure(folds, undefined, layers),
  )
  expect(answer).toMatchObject({ ok: true })
  expect(doom.propOf(saved.nodes.get(made.ids.inner!), "layout")?.mode).toBe("none")
})

it("bakes decomposed Vietnamese to the same stored boxes as precomposed Vietnamese", async () => {
  const bake = async (chars: string) => {
    const made = grown([words("left", chars), words("right", "Next")])
    const { answer, saved } = await agentBakes(made, "inner", (folds, layers) =>
      metrics.measure(folds, undefined, layers),
    )
    expect(answer).toMatchObject({ ok: true })
    return doom.propOf(saved.nodes.get(made.ids.right!), "box")
  }
  const text = "lợi nhuận quý"
  expect(await bake(text.normalize("NFD"))).toEqual(await bake(text))
})

it.each(["السلام عليكم ورحمة الله", "Team 👩‍💻👨‍👩‍👧 ok", "1️⃣", "🇻🇳", "👍🏽"])(
  "refuses to freeze incorrectly shaped text in a row (%s)",
  async (text) => {
    const made = grown([words("left", text), words("right", "Next")])
    const { answer, before, saved } = await agentBakes(made, "inner", (folds, layers) =>
      metrics.measure(folds, undefined, layers),
    )
    expect(answer).toMatchObject({
      ok: false,
      refusal: "fonts",
      reason: "shaping",
      layers: [made.ids.left],
      layerNames: ["left"],
    })
    expect(saved).toEqual(before)
  },
)

it("bakes a frame beside a text layer that has no matching glyphs", async () => {
  const made = grown([words("left", "Revenue"), words("right", "Next")], [], [words("sibling", "Launch 🚀")])
  const { answer } = await agentBakes(made, "inner", (folds, layers) => metrics.measure(folds, undefined, layers))
  expect(answer).toMatchObject({ ok: true })
})

it("preserves the draft while the client still paints a fallback for a required font", async () => {
  const made = grown([words("left", "Revenue"), words("right", "Next")])
  const { answer, before, saved } = await agentBakes(
    made,
    "inner",
    (folds, layers) => metrics.measure(folds, undefined, layers),
    undefined,
    new Set([family.toLowerCase()]),
  )
  expect(answer).toMatchObject({
    ok: false,
    refusal: "fonts",
    reason: "pending",
    layers: [made.ids.left, made.ids.right],
  })
  expect(saved).toEqual(before)
})

it.each([
  ["Team ❤︎ ok", "Noto Color Emoji", "“❤︎”"],
  ["매출 증가 보고서", "Noto Sans KR", "Hangul text"],
  ["매출 증가 보고서".normalize("NFD"), "Noto Sans KR", "Hangul text"],
  ["ᄒᆞᆫᄀᆞᆯ 옛한글", "Noto Sans KR", "Hangul text"],
  ["السلام عليكم", "Geist", "Arabic text"],
  ["Team 👩‍💻 ok", "Noto Color Emoji", "a color emoji sequence"],
])("refuses the whole batch for %s, naming what needs shaping", async (text, font, shaping) => {
  const made = grown([words("left", text, font), words("right", "Next")])
  const { answer, before, saved } = await agentBakes(
    made,
    "inner",
    (folds, layers) => metrics.measure(folds, undefined, layers),
    [
      { op: "set", target: made.ids.headline, text: "Revenue" },
      { op: "set", target: made.ids.inner, layout: "none" },
    ],
  )
  expect(answer).toMatchObject({
    ok: false,
    reason: "shaping",
    layerNames: ["left"],
    shaping: [shaping],
    note: expect.stringContaining("None of the changes in this batch were applied."),
  })
  expect(saved).toEqual(before)
})
