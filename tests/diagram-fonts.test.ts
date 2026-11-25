import { expect, it } from "vitest"
import { FontMetrics } from "../apps/api/src/platform/font-metrics.js"
import { FontSource } from "../apps/api/src/platform/font-source.js"
import { expandComponent } from "../packages/doom/src/component/index.js"
import { ends, librarySpec, resolvedById, role } from "../packages/doom/src/component/testing/diagram-tree.js"
import architecture from "../packages/doom/src/component/testing/architecture.json" with { type: "json" }
import { landTree } from "../packages/doom/src/component/testing/land-tree.js"
import process from "../packages/doom/src/component/testing/process.json" with { type: "json" }
import {
  type Box,
  type Point,
  componentLibrary,
  isRefusal,
  measureWith,
  resolveSlide,
  themeLibrary,
} from "../packages/doom/src/index.js"

const metrics = new FontMetrics(new FontSource(undefined))
const technical = themeLibrary.technical
if (technical === undefined) throw new Error("Missing Technical theme")
const theme = technical.theme
const processComponent = librarySpec("process")
const architectureComponent = librarySpec("architecture")

const defaultCases = Object.entries(themeLibrary).flatMap(([themeId, { theme }]) =>
  Array.from(componentLibrary, ([id, { spec }]) => ({ themeId, theme, id, spec })),
)
it.each(defaultCases)("$id has no default sample findings on $themeId", async ({ id, spec, theme, themeId }) => {
  const sample = spec.sample
  if (sample === undefined) throw new Error(`Missing ${id} sample`)
  const input = { frame: { x: 0, y: 0, w: sample.w, h: sample.h }, data: sample.data, theme }
  const estimate = expandComponent(spec, { ...input, measure: measureWith({}) })
  if (isRefusal(estimate)) throw new Error(JSON.stringify(estimate))
  expect(estimate.findings).toEqual([])
  if (themeId === "technical") {
    const fonts = await metrics.measure([landTree(estimate, theme).doom])
    if (typeof fonts === "string") throw new Error(fonts)
    expect([...fonts.pending, ...fonts.missing]).toEqual([])
    const tree = expandComponent(spec, { ...input, measure: fonts.measure })
    if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
    expect(tree.findings).toEqual([])
    if (id === "tree") {
      const { doom, slide } = landTree(tree, theme)
      const resolved = resolvedById(resolveSlide(doom, slide, fonts.measure))
      for (const { id } of role(tree, "node")) {
        expect(
          resolved
            .get(id)
            ?.text?.lines.flatMap(({ runs }) => runs.map(({ text }) => text))
            .join(" "),
        ).not.toContain("…")
      }
    }
  }
})

const columnCases = [7, 8].flatMap((count) =>
  [false, true].flatMap((descriptions) =>
    [false, true].map((durations) => ({ count, direction: "column", descriptions, durations })),
  ),
)

it.each([...[7, 8].map((count) => ({ count, direction: "row", descriptions: true, durations: true })), ...columnCases])(
  "fits a $count-step $direction with descriptions=$descriptions and durations=$durations using served Geist",
  async ({ count, direction, descriptions: withDescriptions, durations }) => {
    const descriptions = [
      "Align stakeholders on scope",
      "Embed new ways of working",
      "Diagnose the current state",
      "Prioritize initiatives",
      "Design the target model",
      "Plan the transition",
      "Launch the first pilot",
      "Track benefits monthly",
    ]
    const input = {
      frame: direction === "row" ? process.frame : { x: 600, y: 160, w: 720, h: 800 },
      variant: { direction },
      theme,
      data: {
        steps: descriptions.slice(0, count).map((description, i) => ({
          id: String(i),
          label: ["Align", "Embed", "Diagnose", "Prioritize", "Design", "Plan", "Launch", "Track"][i],
          ...(withDescriptions ? { description } : {}),
          ...(durations ? { note: "2 weeks" } : {}),
        })),
      },
    }
    const { tree, cards, resolved } = await servedProcess(input)
    expect(tree.findings.filter(({ kind }) => kind === "text-fit")).toEqual([])
    expect(cards).toHaveLength(count)
    if (direction === "row") expect(new Set(cards.map((card) => card.box.h)).size).toBe(1)
    for (const [i, card] of cards.entries()) {
      const title = input.data.steps[i]?.label
      const lines = card.text?.lines ?? []
      const runs = lines.flatMap((line) => line.runs)
      const words = runs.map((run) => run.text.trim()).join(" ")
      expect(words).toContain(title)
      expect(words).not.toContain("…")
      if (withDescriptions) expect(words).toContain(descriptions[i])
      const durationPart = role(tree, "duration").find((part) => part.key[1] === String(i))
      const duration = durationPart === undefined ? card : resolved.get(durationPart.id)
      const durationLine = duration?.text?.lines.find((line) => line.runs.some((run) => run.text === "2 weeks"))
      if (!durations) {
        expect(durationLine).toBeUndefined()
        continue
      }
      expect(durationLine?.runs.find((run) => run.text === "2 weeks")?.size).toBeGreaterThanOrEqual(20)
      if (direction === "column") {
        const titleLine = lines.find((line) => line.runs.some((run) => run.text === title))
        expect(Math.abs(duration!.box.y + durationLine!.y - card.box.y - titleLine!.y)).toBeLessThanOrEqual(1)
        expect(durationLine?.align).toBe("right")
      }
    }
  },
)

it.each([3, 4, 5, 6, 7, 8])("aligns the titles of a %i-step row with focus on any step", async (count) => {
  const steps = Array.from({ length: count }, (_, i) => ({ id: String(i), label: `Step ${i + 1}` }))
  for (const { id: focus } of steps) {
    const { cards } = await servedProcess({ frame: process.frame, theme, data: { steps }, tokens: { focus } })
    const titles = cards.map((card, i) =>
      card.text?.lines.find((line) => line.runs.map((run) => run.text).join("") === steps[i]?.label),
    )
    expect(titles.every((line) => line !== undefined)).toBe(true)
    expect(new Set(titles.map((line) => line?.y)).size).toBe(1)
    expect(new Set(cards.map((card) => card.text?.lines[0]?.runs[0]?.size)).size).toBe(1)
  }
})

async function servedProcess(input: Omit<Parameters<typeof expandComponent>[1], "measure">) {
  const estimate = expandComponent(processComponent, { ...input, measure: measureWith({}) })
  if (isRefusal(estimate)) throw new Error(JSON.stringify(estimate))
  const fonts = await metrics.measure([landTree(estimate, theme).doom])
  if (typeof fonts === "string") throw new Error(fonts)
  expect([...fonts.pending, ...fonts.missing]).toEqual([])
  const tree = expandComponent(processComponent, { ...input, measure: fonts.measure })
  if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
  const { doom, slide } = landTree(tree, theme)
  const resolved = resolvedById(resolveSlide(doom, slide, fonts.measure))
  return { tree, resolved, cards: role(tree, "card").map(({ id }) => resolved.get(id)!) }
}

async function servedMeasure() {
  const tree = expandComponent(architectureComponent, { ...architecture, theme, measure: measureWith({}) })
  if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
  const fonts = await metrics.measure([landTree(tree, theme).doom])
  if (typeof fonts === "string") throw new Error(fonts)
  expect([...fonts.pending, ...fonts.missing]).toEqual([])
  return fonts.measure
}

const crosses = (a: Point, b: Point, box: Box) =>
  a.y === b.y
    ? a.y > box.y && a.y < box.y + box.h && Math.max(a.x, b.x) > box.x && Math.min(a.x, b.x) < box.x + box.w
    : a.x > box.x && a.x < box.x + box.w && Math.max(a.y, b.y) > box.y && Math.min(a.y, b.y) < box.y + box.h

function expectClear(data: typeof architecture.data, measure: Awaited<ReturnType<typeof servedMeasure>>) {
  const tree = expandComponent(architectureComponent, { ...architecture, theme, data, measure })
  if (isRefusal(tree)) throw new Error(JSON.stringify(tree))
  const { doom, slide } = landTree(tree, theme)
  const resolved = resolvedById(resolveSlide(doom, slide, measure))
  const hits: string[] = []
  const routes: { id: string; nodes: readonly string[]; points: readonly Point[] }[] = []
  const overlaps = (a: Point, b: Point, c: Point, d: Point) =>
    (Math.abs(a.y - b.y) < 1e-6 &&
      Math.abs(c.y - d.y) < 1e-6 &&
      Math.abs(a.y - c.y) < 12 - 1e-6 &&
      Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > 1e-6) ||
    (Math.abs(a.x - b.x) < 1e-6 &&
      Math.abs(c.x - d.x) < 1e-6 &&
      Math.abs(a.x - c.x) < 12 - 1e-6 &&
      Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > 1e-6)
  for (const link of role(tree, "link")) {
    const { start, end } = ends(link)
    const route = resolved.get(link.id)
    if (route?.geometry?.kind !== "line") throw new Error("Missing line")
    const points = route.geometry.points.map(({ x, y }) => ({ x: x + route.box.x, y: y + route.box.y }))
    for (const other of routes) {
      if (other.nodes.includes(start.node) || other.nodes.includes(end.node)) continue
      if (
        points
          .slice(1)
          .some((b, i) => other.points.slice(1).some((d, j) => overlaps(points[i]!, b, other.points[j]!, d)))
      )
        hits.push(`${link.key[1]} overlaps ${other.id}`)
    }
    routes.push({ id: link.key[1]!, nodes: [start.node, end.node], points })
    for (const card of role(tree, "component")) {
      if (card.id === start.node || card.id === end.node) continue
      const box = resolved.get(card.id)!.box
      if (
        points
          .slice(1)
          .some((point, i) =>
            crosses(points[i]!, point, { ...box, x: box.x - 12, y: box.y - 12, w: box.w + 24, h: box.h + 24 }),
          )
      )
        hits.push(`${link.key[1]} → ${card.key[1]}`)
    }
  }
  expect(hits).toEqual([])
  return routes
}

it("keeps skip-layer and non-neighbor links clear of cards in the verifier's examples", async () => {
  const measure = await servedMeasure()
  const shipped = new Map(expectClear(architecture.data, measure).map((route) => [route.id, route.points]))
  const sharedEntry = (id: string) => shipped.get(id)?.slice(-2)
  const sharedExit = (id: string) => shipped.get(id)?.slice(0, 2)
  expect(sharedEntry("mobile")).toEqual(sharedEntry("partners"))
  expect(sharedExit("write")).toEqual(sharedExit("publish"))
  expectClear(
    {
      ...architecture.data,
      links: [
        ...architecture.data.links,
        { id: "skip", from: "mobile", to: "events" },
        { id: "lateral", from: "identity", to: "payments" },
        { id: "upskip", from: "storage", to: "web" },
        { id: "lower-lateral", from: "postgres", to: "storage" },
      ],
    },
    measure,
  )
  expectClear(
    {
      layers: architecture.data.layers,
      components: architecture.data.layers.map(({ id }) => ({ id, layer: id, name: id })),
      links: [{ id: "skip-centered", from: "channels", to: "data" }],
    },
    measure,
  )
})

it.each([2, 3, 4, 5])("keeps unrelated links and cards clear in seeded %i-layer graphs", async (count) => {
  const measure = await servedMeasure()
  let seed = 1661
  const pick = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return Math.floor((seed / 2 ** 32) * n)
  }
  const layers = Array.from({ length: count }, (_, i) => ({ id: `layer-${i}`, label: `Layer ${i + 1}` }))
  for (let graph = 0; graph < 20; graph++) {
    const components = layers.flatMap(({ id: layer }) =>
      Array.from({ length: 1 + pick(6) }, (_, i) => ({ id: `${layer}-${i}`, layer, name: `Service ${i + 1}` })),
    )
    const links = Array.from({ length: 16 }, (_, i) => {
      const a = pick(components.length)
      const b = (a + 1 + pick(components.length - 1)) % components.length
      return { id: `link-${i}`, from: components[a]!.id, to: components[b]!.id }
    })
    expectClear({ layers, components, links }, measure)
  }
})
