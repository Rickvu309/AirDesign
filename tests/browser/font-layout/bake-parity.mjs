import { packageBuild } from "../../../scripts/package-build.mjs"
import { english, japanese } from "./business-text.mjs"
import { corpus, paintStyleCases } from "./cases.mjs"
import { fixtureBytes, manifest } from "./fixture-faces.mjs"

const families = {
  Arabic: "Noto Sans Arabic",
  Balinese: "Noto Sans Balinese",
  Devanagari: "Noto Sans Devanagari",
  Emoji: "Noto Color Emoji",
  Garamond: "EB Garamond",
  Geist: "Geist",
  Hebrew: "Noto Sans Hebrew",
  Inter: "Inter",
  JP: "Noto Sans JP",
  Javanese: "Noto Sans Javanese",
  KR: "Noto Sans KR",
  Lora: "Lora",
  Math: "Noto Sans Math",
  Myanmar: "Noto Sans Myanmar",
  Narrow: "Liberation Sans Narrow",
  NarrowBold: "Liberation Sans Narrow",
  NarrowItalic: "Liberation Sans Narrow",
  Playfair: "Playfair Display",
  Serif: "Noto Serif",
  Sundanese: "Noto Sans Sundanese",
  Symbols: "Noto Sans Symbols 2",
  Thai: "Noto Sans Thai",
}

const additional = [
  ["legacy-soft-hyphens", "soft\u00adhy\u00adphen\u00adated wordy\u00adwords", "Narrow"],
  ["legacy-japanese-closers", "「東京、。」を読む", "JP"],
  ["legacy-japanese-openers", "「東」、（テスト）。", "JP"],
].map(([id, text, name]) => ({ id, runs: [{ text, faces: [name], size: 44, weight: 400 }] }))

async function fixtureSource() {
  const faces = new Map()
  const bytes = new Map()
  await Promise.all(
    Object.entries(families).map(async ([id, family]) => {
      const fixture = manifest[id]
      const file = fixture.file
      const url = `/fonts/file?family=${encodeURIComponent(family)}&file=${encodeURIComponent(file)}`
      const found = faces.get(family) ?? []
      found.push({ file, url, style: fixture.style ?? "normal", weight: fixture.weight })
      faces.set(family, found)
      bytes.set(url, await fixtureBytes(fixture))
    }),
  )
  const family = async (name) => (faces.has(name) ? { ok: true, family: name, faces: faces.get(name) } : { ok: false })
  return {
    family,
    file: async (name, file) => bytes.get(faces.get(name)?.find((face) => face.file === file)?.url),
    fetch: async (input) => {
      const url = new URL(input, "https://fixtures.test")
      if (url.pathname === "/fonts/family") {
        const result = await family(url.searchParams.get("family"))
        return Response.json(result, { status: result.ok ? 200 : 404 })
      }
      return new Response(bytes.get(input), { status: bytes.has(input) ? 200 : 404 })
    },
  }
}

const box = (w, h) => ({ x: 0, y: 0, w, h, rotation: 0, flipH: false, flipV: false })

function make(keeper, item, width, theme) {
  let chars = item.chars ?? ""
  const spans =
    item.spans ??
    item.runs?.map((run) => {
      chars += run.text
      return {
        end: chars.length,
        font: families[run.faces[0]],
        bold: run.weight >= 600,
        italic: run.italic ?? false,
        size: run.size,
        tracking: run.tracking ?? 0,
        ...(run.color ? { color: { var: "accent1" } } : {}),
      }
    }) ??
    []
  const fixed = width !== null
  const text = {
    chars,
    spans,
    paras: chars.split("\n").map(() => ({})),
    style: item.style ?? "body",
    alignV: "top",
    wrap: "words",
    resize: fixed ? "height" : "widthAndHeight",
  }
  return keeper.doomFromTree({
    theme,
    slides: [
      {
        children: [
          {
            type: "frame",
            name: "row",
            props: {
              box: box(1, 1),
              sizing: { w: "hug", h: "hug" },
              layout: { mode: "row", gap: 12, padding: { t: 0, r: 0, b: 0, l: 0 }, align: "top-left" },
            },
            children: [
              {
                type: "shape",
                name: "fixture",
                props: { box: box(width ?? 1, 1), sizing: { w: fixed ? "fixed" : "hug", h: "hug" }, text },
              },
              { type: "shape", name: "sibling", props: { box: box(12, 12) } },
            ],
          },
        ],
      },
    ],
  })
}

const delta = (left, right) => Math.max(...["x", "y", "w", "h"].map((edge) => Math.abs(left[edge] - right[edge])))

export async function bakeParity(business = false) {
  const root = process.cwd()
  const doom = await packageBuild(root, "@airdesign/doom")
  const { measureDoom } = await packageBuild(root, "@airdesign/render")
  const { FontMetrics } = await packageBuild(root, "@airdesign/api", "platform/font-metrics.js")
  const { callTool, emptyLog } = await packageBuild(root, "@airdesign/mcp")
  const { memoryDecks } = await packageBuild(root, "@airdesign/mcp", "testing/evals.js")
  const source = business ? await servedSource(root) : await fixtureSource()
  const jp = { ...doom.defaultTheme, fonts: { heading: "Noto Sans JP", body: "Noto Sans JP" } }
  const groups = business
    ? [
        ...Object.entries(doom.themeLibrary).map(([name, { theme }]) => ({ name, theme, items: english })),
        { name: "japanese-inter", theme: doom.defaultTheme, items: japanese },
        { name: "japanese-noto", theme: jp, items: japanese },
      ]
    : [{ name: "corpus", theme: doom.defaultTheme, items: [...corpus, ...paintStyleCases, ...additional] }]
  const metrics = new FontMetrics(source)
  const original = { fetch: globalThis.fetch, FontFace: globalThis.FontFace }
  const doc = { fonts: new Set() }
  globalThis.fetch = source.fetch
  globalThis.FontFace = class {
    async load() {
      return this
    }
  }
  const results = []
  try {
    for (const { name, theme, items } of groups)
      for (const item of items) {
        for (const width of business
          ? [null]
          : item.id === "legacy-soft-hyphens"
            ? [null, 160]
            : [null, 155, 205, 390]) {
          const { doom: fold, slides, ids } = make(doom, item, width, theme)
          const canvas = await measureDoom(doc, fold)
          const legacy = await metrics.measure([fold], Infinity, [ids.fixture])
          if (typeof legacy === "string") throw new Error(`${item.id}: ${legacy}`)
          const desired = doom.solveLayout(fold, slides[0], canvas)
          const old = doom.solveLayout(fold, slides[0], legacy.measure)
          const id = "canvas-bake"
          const host = {
            ...memoryDecks(() => fold, new Map([[id, fold]])),
            measure: (folds, layers) => metrics.measure(folds, Infinity, layers),
          }
          const session = { agent: "aira", mint: () => "m", log: emptyLog(), now: 0, once: "bake" }
          const { answer } = await callTool(
            "airdesign_edit_deck",
            {
              deck: id,
              base: fold.rev,
              changes: [{ op: "set", target: ids.row, layout: "none" }],
            },
            session,
            host,
          )
          const saved = host.decks.get(id)
          const layers = [ids.fixture, ids.row, ids.sibling]
          const difference = Math.max(...layers.map((layer) => delta(desired.get(layer), old.get(layer))))
          const savedDifference = answer.ok
            ? Math.max(...layers.map((layer) => delta(desired.get(layer), doom.propOf(saved.nodes.get(layer), "box"))))
            : undefined
          results.push({ group: name, id: item.id ?? item.chars, width, difference, savedDifference, answer })
        }
      }
  } finally {
    globalThis.fetch = original.fetch
    globalThis.FontFace = original.FontFace
  }
  return results
}

async function servedSource(root) {
  const { fontShelf, offShelf, shelfFolder } = await import("../../../scripts/font-shelf.mjs")
  const { FontSource } = await packageBuild(root, "@airdesign/api", "platform/font-source.js")
  const source = new FontSource(fontShelf(shelfFolder), offShelf)
  source.fetch = async (input) => {
    const url = new URL(input, "https://fixtures.test")
    const family = url.searchParams.get("family")
    if (!url.searchParams.has("file")) {
      const result = await source.family(family)
      return Response.json(result, { status: result.ok ? 200 : 404 })
    }
    const bytes = await source.file(family, url.searchParams.get("file"))
    return new Response(bytes, { status: bytes === undefined ? 404 : 200 })
  }
  return source
}
