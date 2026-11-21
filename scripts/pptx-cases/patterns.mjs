import { fileURLToPath, pathToFileURL } from "node:url"
import { slideExportLines } from "../slide-export.mjs"

const original = "blank.pptx"
const build = (name) => pathToFileURL(fileURLToPath(new URL(`../../packages/${name}/dist/index.js`, import.meta.url)))
const counts = { kpi: 6, cards: 6, compare: 3, matrix: 4, timeline: 6 }
const patterns = Object.keys(counts)
const writtenName = (pattern) => `written-pattern-${pattern}.pptx`
const axes = ["Effort", "Impact"]

const item = (at) => ({
  title: `Heading ${at + 1}: a title that runs long enough to wrap`,
  value: ["$148.2M", "61.4%", "118%", "14", "3.4x", "−$0.9M"][at],
  note: "▲ 24% year on year, +$2.1M against the board-approved plan",
  points: [`Point ${at + 1} carries a full sentence of detail`, "A second point", "A third point"],
})

const shown = (pattern, at) =>
  pattern === "kpi" || pattern === "timeline" ? `Heading ${at + 1}:` : `Point ${at + 1} carries`

export default {
  covers: [],
  originals: [original],
  written: patterns.map(writtenName),
  async write({ pptx, parts }) {
    const { readDeckId } = await import(build("catalog").href)
    const { call, openDeck } = await import(build("engine").href)
    const deck = parts.get(original)
    const index = pptx.indexPackage(deck)
    const id = readDeckId("deck")
    if (!id.ok) throw new Error("patterns deck id")
    const opened = openDeck(id.deck)
    const start = {
      ...opened,
      register: { ...opened.register, index: { ...index, total: index.elements.length, pages: [] } },
    }
    const slide = index.slides[0].id
    return patterns.map((pattern) => {
      const changes = [
        ...index.elements.map((element) => ({ op: "delete", node: element.node })),
        {
          op: "diagram",
          slide,
          pattern,
          ...(pattern === "matrix" ? { labels: axes } : {}),
          box: { x: 64, y: 110, w: 832, h: 380 },
          items: Array.from({ length: counts[pattern] }, (_, at) => item(at)),
        },
      ]
      const result = call(
        "edit_deck",
        start,
        { actor: "agent", runId: "run" },
        { deck: "deck", base: start.revision, changes },
      )
      if (!result.ok) throw new Error(`patterns ${pattern} ${result.refusal}`)
      const { register } = result.deck
      return {
        name: writtenName(pattern),
        original,
        parts: pptx.exportParts(pptx.orderedParts(deck, register), register),
      }
    })
  },
  lines(answers) {
    const { pptx, parts } = answers
    const before = parts.get(original)
    if (before === undefined) return ["patterns original missing"]
    const part = pptx.readSlides(before)[0]?.part
    const touched = [part, "[Content_Types].xml", "ppt/slides/_rels/slide1.xml.rels"]
    const kept = [...before.keys()].filter((name) => !touched.includes(name))
    return patterns.flatMap((pattern) => {
      const exported = writtenName(pattern)
      const after = parts.get(exported)
      if (after === undefined) return [`patterns ${pattern} not written`]
      const lines = slideExportLines({ ...answers, original, exported, kept }).map((line) =>
        line.replace(/^slide export/, `patterns ${pattern}`),
      )
      const xml = new TextDecoder().decode(after.get(part))
      for (let at = 0; at < counts[pattern]; at += 1)
        if (!xml.includes(shown(pattern, at))) lines.push(`patterns ${pattern} lost the words of item ${at + 1}`)
      if (pattern === "matrix" && !(xml.includes(axes[0]) && xml.includes(axes[1]) && xml.includes('vert="vert270"')))
        lines.push("patterns matrix lost an axis title or its turn")
      const frames = pptx.indexPackage(after).elements.filter((element) => element.framing !== undefined)
      if (frames.length < counts[pattern])
        lines.push(`patterns ${pattern} reads back ${frames.length} auto layout frames`)
      return lines
    })
  },
}
