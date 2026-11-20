import { fileURLToPath, pathToFileURL } from "node:url"
import { slideExportLines } from "../slide-export.mjs"

const documentBuild = pathToFileURL(fileURLToPath(new URL("../../packages/document/dist/index.js", import.meta.url)))
const decoder = new TextDecoder()

const office = "office-chart.pptx"
const census = "census-updating-spm.pptx"
const writtenOffice = "written-chart-look-office.pptx"
const writtenCensus = "written-chart-look-census.pptx"

const officeEdits = [
  {
    at: 0,
    change: (chart) => ({
      ...chart,
      title: "Revenue grew in every region",
      labels: "#,##0.0",
      legend: "right",
      gap: 60,
      axis: false,
      series: chart.series.map((series, at) => (at === 1 ? { ...series, color: { rgb: "1F4E79" } } : series)),
    }),
  },
  {
    at: 1,
    change: ({ title: _, ...chart }) => ({
      ...chart,
      legend: "none",
      gridlines: false,
      labels: "#,##0.0",
      series: chart.series.map((series, at) => (at === 0 ? { ...series, color: { scheme: "accent6" } } : series)),
    }),
  },
]

const censusEdits = [
  { at: 0, change: (chart) => ({ ...chart, title: "Most people saw no change", labels: "0.0%" }) },
  { at: 2, change: ({ labels: _, ...chart }) => ({ ...chart, legend: "right" }) },
]

const keptLook = [
  ["chart frame and font", (xml) => xml.slice(xml.indexOf("</c:chart>"))],
  ["category axis", (xml) => /<c:catAx>.*?<\/c:catAx>/su.exec(xml)?.[0] ?? ""],
  ["slice looks", (xml) => (xml.match(/<c:dPt>.*?<\/c:dPt>/gsu) ?? []).join("")],
]
const written = new Map()
let canonical = (value) => JSON.stringify(value)

function landed(document, register, node, patch) {
  let current = register
  if (!current.nodes.includes(node)) {
    const opened = document.decide(current, { command: "add", node, floor: "", route: "" })
    if (opened.decision !== "apply") throw new Error(`chart look ${node} ${opened.code}`)
    current = opened.register
  }
  const decision = document.decide(current, { command: "person", node, v: document.format, patch })
  if (decision.decision !== "apply") throw new Error(`chart look ${node} ${decision.code}`)
  return decision.register
}

function edited(pptx, document, deck, edits, name) {
  const { slides, elements } = pptx.indexPackage(deck)
  let register = {
    ...document.openRegister("", ""),
    index: { format: 2, total: elements.length, slides, elements, pages: [] },
  }
  const charts = elements.filter((element) => element.kind === "chart")
  const wanted = []
  for (const edit of edits) {
    const element = charts[edit.at]
    const [slide, shape] = element.node.split(".")
    const part = pptx.readSlides(deck).find((row) => row.slide === slide)?.part
    const chartPart = pptx.chartPartOf(deck, part, shape)
    const value = edit.change(pptx.chartValueOf(deck.get(chartPart)))
    const plan = document.planChange(
      { target: { node: element.node }, chart: { value: JSON.stringify(value) } },
      document.registerScope(register),
    )
    if (!plan.ok) throw new Error(`chart look ${element.node} ${plan.refusals[0]?.code}`)
    for (const { node, row } of plan.rows) register = landed(document, register, node, row.patch)
    wanted.push({ chartPart, value })
  }
  written.set(name, wanted)
  return pptx.exportParts(deck, register)
}

function lookLines(pptx, before, after, name) {
  const lines = []
  for (const { chartPart, value } of written.get(name) ?? []) {
    const [was, now] = [decoder.decode(before.get(chartPart)), decoder.decode(after.get(chartPart))]
    const read = pptx.chartValueOf(after.get(chartPart))
    if (read === null || canonical(read) !== canonical(value))
      lines.push(`chart look ${chartPart} reads back as ${JSON.stringify(read)}`)
    for (const [part, of] of keptLook)
      if (of(was) !== of(now)) lines.push(`chart look ${chartPart} changed the deck's ${part}`)
  }
  const workbooks = [...after.keys()].filter(
    (part) => part.startsWith("ppt/embeddings/") && !Buffer.from(after.get(part)).equals(Buffer.from(before.get(part))),
  )
  if (workbooks.length > 0) lines.push(`chart look rewrote ${workbooks.join(", ")} for a change of look alone`)
  lines.push(...pptx.chartWorkbookErrors(after).map((error) => `chart look ${error}`))
  return lines
}

export default {
  covers: ["chart.value"],
  originals: [office, census],
  written: [writtenOffice, writtenCensus],
  async write({ pptx, parts }) {
    const document = await import(documentBuild.href)
    canonical = document.writeChartValue
    return [
      {
        name: writtenOffice,
        original: office,
        parts: edited(pptx, document, parts.get(office), officeEdits, writtenOffice),
      },
      {
        name: writtenCensus,
        original: census,
        parts: edited(pptx, document, parts.get(census), censusEdits, writtenCensus),
      },
    ]
  },
  lines(answers) {
    const { pptx, parts } = answers
    const lines = []
    for (const [original, exported] of [
      [office, writtenOffice],
      [census, writtenCensus],
    ]) {
      const before = parts.get(original)
      const after = parts.get(exported)
      if (before === undefined || after === undefined) {
        lines.push(`chart look ${exported} not written`)
        continue
      }
      const touched = new Set((written.get(exported) ?? []).map((row) => row.chartPart))
      const kept = [...before.keys()].filter((part) => !touched.has(part))
      lines.push(
        ...slideExportLines({ ...answers, original, exported, kept }).map((line) =>
          line.replace(/^slide export/, `chart look ${exported}`),
        ),
      )
      lines.push(...lookLines(pptx, before, after, exported))
    }
    return lines
  },
}
