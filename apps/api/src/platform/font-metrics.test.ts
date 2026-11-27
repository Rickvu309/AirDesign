import * as doom from "@airdesign/doom"
import { fallbackFont } from "@airdesign/fonts"
import { problemRules } from "@airdesign/taste"
import { expect, it } from "vitest"
import { FontMetrics, servedFontMetrics } from "./font-metrics.js"
import { FontSource } from "./font-source.js"

const family = "Liberation Sans Narrow"
const line = "Revenue grew 12% to $48.2M"
const canvas = { regular: 11.03173828125, bold: 11.39453125, kernAV: -0.06005859375 }

const widthOf = (face: doom.FontFace, words: string) =>
  [...words].reduce(
    (sum, char, at) => sum + (face.advances[char] ?? 0) + (at === 0 ? 0 : (face.kerning?.[words[at - 1]! + char] ?? 0)),
    0,
  )

const deckIn = (fonts: { heading: string; body: string }, words = line) =>
  doom.doomFromTree({
    theme: { ...doom.defaultTheme, fonts },
    slides: [
      {
        children: [
          {
            type: "shape",
            name: "title",
            props: {
              box: { x: 100, y: 100, w: 600, h: 100, rotation: 0, flipH: false, flipV: false },
              text: { ...doom.textFromMarkdown(words, "title"), resize: "fixed" },
            },
          },
        ],
      },
    ],
  })

function anyNameIsLiberation() {
  const calls: string[] = []
  const local = new FontSource(undefined)
  return {
    calls,
    source: {
      family: async (name: string) => {
        calls.push(name)
        if (name === "Never") return { ok: false, refusal: "unknown", family: name } as const
        if (name === "Broken") throw new Error("font download")
        if (name === "Slow") return new Promise<never>(() => undefined)
        return local.family(family)
      },
      file: (_name: string, file: string) => local.file(family, file),
    },
  }
}

it("reads a served face's advances and pair kerning as Chromium's canvas measures them", async () => {
  const widths = await new FontMetrics(new FontSource(undefined)).widths({
    faces: [
      { font: family, bold: false, italic: false },
      { font: family, bold: true, italic: false },
    ],
    texts: [line, "AV"],
  })
  if (typeof widths === "string") throw new Error(widths)
  const regular = widths.widths[doom.fontFace(family, false, false)]!
  const bold = widths.widths[doom.fontFace(family, true, false)]!
  expect(widthOf(regular, line)).toBeCloseTo(canvas.regular, 4)
  expect(widthOf(bold, line)).toBeCloseTo(canvas.bold, 4)
  expect(regular.kerning?.AV).toBeCloseTo(canvas.kernAV, 4)
  expect(regular.ascent).toBeGreaterThan(0)
})

it("finds both overflow and a lone last word using the deck's theme fonts", async () => {
  const grown = deckIn({ heading: family, body: family })
  const measured = await new FontMetrics(new FontSource(undefined)).measure([grown.doom])
  if (typeof measured === "string") throw new Error(measured)
  expect(doom.layoutProblems(grown.doom, grown.slides, measured.measure, problemRules)).toMatchObject([
    { code: "overflow", node: grown.ids.title, room: 100 },
    { code: "lone-word", node: grown.ids.title, extra: 13 },
  ])
})

it("answers fonts when a deck's font fails to download, and asks again only after a minute", async () => {
  const { calls, source } = anyNameIsLiberation()
  let now = 0
  const metrics = new FontMetrics(source, () => now)
  const deck = deckIn({ heading: "Broken", body: family }).doom
  const asked = () => calls.filter((name) => name === "Broken").length
  expect(await metrics.measure([deck])).toBe("fonts")
  const first = asked()
  now = 30_000
  expect(await metrics.measure([deck])).toBe("fonts")
  expect(asked()).toBe(first)
  now = 61_000
  expect(await metrics.measure([deck])).toBe("fonts")
  expect(asked()).toBe(first * 2)
})

it("names the characters a deck's font has no letters for, and only those", async () => {
  const metrics = new FontMetrics(new FontSource(undefined))
  const read = async (words: string) => {
    const measured = await metrics.measure([deckIn({ heading: family, body: family }, words).doom])
    if (typeof measured === "string") throw new Error(measured)
    return [...measured.missing.values()].flatMap((chars) => [...chars])
  }
  expect(await read("Doanh thu quý 3 tăng, lợi nhuận giữ ở mức 31%")).toEqual([])
  expect(await read("収益 grew 12% نمت")).toEqual(["収", "益", "ن", "م", "ت"])
})

it("names a letter only when the face that paints it lacks it, not when another face on the deck does", async () => {
  const made = doom.doomFromTree({
    theme: { ...doom.defaultTheme, fonts: { heading: family, body: family } },
    slides: [
      {
        children: [
          { type: "shape", props: { text: doom.textFromMarkdown("Beta β", "body") } },
          {
            type: "shape",
            props: { text: { ...doom.textFromMarkdown("Revenue", "body"), spans: [{ end: 7, font: fallbackFont }] } },
          },
        ],
      },
    ],
  })
  const measured = await new FontMetrics(new FontSource(undefined)).measure([made.doom])
  if (typeof measured === "string") throw new Error(measured)
  expect([...measured.missing.values()].flatMap((chars) => [...chars])).toEqual([])
  const own = await new FontMetrics(new FontSource(undefined)).measure([
    deckIn({ heading: fallbackFont, body: fallbackFont }, "Beta β").doom,
  ])
  expect(typeof own === "string" ? own : [...own.missing.values()].flatMap((chars) => [...chars])).toEqual(["β"])
})

const served = new FontSource(undefined)
const face = (font: string) => ({ font, bold: false, italic: false })
const widthsOf = async (font: string, texts: readonly string[]) => {
  const read = await new FontMetrics(served).widths({ faces: [face(font)], texts })
  if (typeof read === "string") throw new Error(read)
  return read.widths[doom.fontFace(font, false, false)]!
}

it("measures a family no one serves with the painter's fallback font, as the canvas stack falls to it", async () => {
  const words = ["Wiggle waves AVAVA", "illi MMMM ... WWW"]
  expect(await widthsOf("AirDesign Missing Face", words)).toEqual(await widthsOf(fallbackFont, words))
})

it("measures a letter the font lacks from the fallback font, and kerns only letters of one font", async () => {
  const words = ["lợi Wợ"]
  const narrow = await widthsOf(family, words)
  const fallback = await widthsOf(fallbackFont, words)
  expect(narrow.advances["ợ"]).toBe(fallback.advances["ợ"])
  expect(narrow.advances.l).not.toBe(fallback.advances.l)
  expect(narrow.kerning?.["lợ"]).toBeUndefined()
  expect(fallback.kerning?.["Wợ"]).toBeDefined()
  expect(narrow.kerning?.["Wợ"]).toBeUndefined()
})

it("measures a face no one serves in bold and italic with the fallback's bold and italic", async () => {
  const read = await new FontMetrics(served).widths({
    faces: [{ font: "Never Served", bold: true, italic: true }],
    texts: ["Bold italic"],
  })
  const own = await new FontMetrics(served).widths({
    faces: [{ font: fallbackFont, bold: true, italic: true }],
    texts: ["Bold italic"],
  })
  if (typeof read === "string" || typeof own === "string") throw new Error("fonts")
  expect(read.widths[doom.fontFace("Never Served", true, true)]).toEqual(
    own.widths[doom.fontFace(fallbackFont, true, true)],
  )
})

it("names a missing character on every measure, not only the first", async () => {
  const metrics = new FontMetrics(new FontSource(undefined))
  const deck = deckIn({ heading: family, body: family }, "Launch 🚀").doom
  for (let time = 0; time < 3; time += 1) {
    const measured = await metrics.measure([deck])
    if (typeof measured === "string") throw new Error(measured)
    expect([...measured.missing.values()].flatMap((chars) => [...chars])).toEqual(["🚀"])
  }
})

it("answers time past the budget, and at once while that font still hangs", async () => {
  const { calls, source } = anyNameIsLiberation()
  let now = 0
  const metrics = new FontMetrics(source, () => now)
  const deck = deckIn({ heading: "Slow", body: "Slow" }).doom
  expect(await metrics.measure([deck], 50)).toBe("time")
  now = 120_000
  expect(await metrics.measure([deck], 60_000)).toBe("time")
  expect(calls.filter((name) => name === "Slow")).toHaveLength(2)
})

it("asks for every face of a deck at once, not one after another", async () => {
  const asked: string[] = []
  const local = new FontSource(undefined)
  let open: () => void = () => undefined
  const gate = new Promise<void>((resolve) => (open = resolve))
  const metrics = new FontMetrics({
    family: async (name) => {
      asked.push(name)
      await gate
      return local.family(family)
    },
    file: (_name, file) => local.file(family, file),
  })
  const pending = metrics.widths({
    faces: [
      { font: "One", bold: false, italic: false },
      { font: "Two", bold: false, italic: false },
    ],
    texts: ["a"],
  })
  await Promise.resolve()
  expect(asked).toEqual(["One", fallbackFont, "Two"])
  open()
  expect(typeof (await pending)).toBe("object")
})

it("keeps at most twenty faces, loading the oldest again when it comes back", async () => {
  const { calls, source } = anyNameIsLiberation()
  const metrics = new FontMetrics(source)
  const faces = (name: string) => ({ faces: [{ font: name, bold: false, italic: false }], texts: ["a"] })
  for (let at = 0; at <= 20; at += 1) await metrics.widths(faces(`Face ${String(at)}`))
  await metrics.widths(faces("Face 20"))
  expect(calls.filter((name) => name === "Face 20")).toHaveLength(1)
  await metrics.widths(faces("Face 0"))
  expect(calls.filter((name) => name === "Face 0")).toHaveLength(2)
})

it("measures with the fonts the API serves, one measurer for each", async () => {
  const { calls, source } = anyNameIsLiberation()
  const metrics = servedFontMetrics(source)
  expect(servedFontMetrics(source)).toBe(metrics)
  await metrics.widths({ faces: [{ font: "Lora", bold: false, italic: false }], texts: ["a"] })
  expect(calls).toEqual(["Lora", fallbackFont])
})

it("keeps missing glyphs on the face that lacks them even when another face covers them", async () => {
  const deck = doom.doomFromTree({
    theme: { ...doom.defaultTheme, fonts: { heading: family, body: family } },
    slides: [
      {
        children: [
          { type: "shape", name: "covered", props: { text: doom.textFromMarkdown("β", "body") } },
          {
            type: "shape",
            name: "missing",
            props: { text: { ...doom.textFromMarkdown("β", "body"), spans: [{ end: 1, font: fallbackFont }] } },
          },
        ],
      },
    ],
  })
  const measured = await new FontMetrics(served).measure([deck.doom])
  if (typeof measured === "string") throw new Error(measured)
  expect(measured.missing).toEqual(new Map([[fallbackFont, new Set(["β"])]]))
  expect(doom.unmeasuredTexts(deck.doom, deck.slides, measured.missing)).toEqual([deck.ids.missing])
})

it("records shared shaping through the Doom measure without changing its result", async () => {
  const { source } = anyNameIsLiberation()
  const deck = deckIn({ heading: family, body: family }, "office soft\u00adhyphen").doom
  const plain = await new FontMetrics(source).measure([deck])
  const title = [...deck.nodes.values()].find((node) => node.type === "shape")
  const text = title?.type === "shape" ? title.text : undefined
  if (text === undefined || typeof plain === "string") throw new Error("Expected a text layer")
  const { theme } = doom.deckOf(deck)
  const original = plain.measure(text, theme, null)
  const record = await new Promise<import("@airdesign/fonts").LayoutComparison>((resolve, reject) => {
    void new FontMetrics(source, Date.now, resolve)
      .measure([deck])
      .then((compared) => {
        if (typeof compared === "string") throw new Error(compared)
        expect(compared.measure(text, theme, null)).toEqual(original)
      })
      .catch(reject)
  })
  expect(record.kind).toBe("measured")
  if (record.kind !== "measured") throw new Error(record.kind)
  expect(record.legacy).toEqual(original.lines.map(({ start, end, ink }) => ({ start, end, ink })))
  expect(record.shared.at(-1)?.end).toBe(text.chars.length)
  expect(JSON.stringify(record)).not.toContain(text.chars)
})

it("evicts old faces when their bytes reach 48 MiB even below twenty faces", async () => {
  const { calls, source } = anyNameIsLiberation()
  const metrics = new FontMetrics({
    family: source.family,
    async file(name, file) {
      const bytes = await source.file(name, file)
      if (bytes === undefined || name === fallbackFont) return bytes
      const padded = Buffer.alloc(20 * 1024 * 1024)
      bytes.copy(padded)
      return padded
    },
  })
  const load = (font: string) => metrics.widths({ faces: [{ font, bold: false, italic: false }], texts: ["a"] })
  await load("One")
  await load("Two")
  await load("Three")
  await load("Three")
  expect(calls.filter((name) => name === "Three")).toHaveLength(1)
  await load("One")
  expect(calls.filter((name) => name === "One")).toHaveLength(2)
})
