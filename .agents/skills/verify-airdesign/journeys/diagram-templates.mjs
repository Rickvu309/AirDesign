import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { PNG } from "pngjs"
import { fontShelf, shelfFolder } from "../../../../scripts/font-shelf.mjs"
import { packageBuild } from "../../../../scripts/package-build.mjs"
import { exportCopy, frameCopy, productCopy } from "../bin/product-copy.mjs"
import {
  clickSlide,
  dragSlide,
  landNodes,
  openDesign,
  openDoomDeck,
  readDoom,
  slowPaint,
  spot,
  words,
} from "../look/doom-deck.mjs"

const descriptionExamples = [
  "Align stakeholders on scope",
  "Set success criteria",
  "Validate a direction",
  "Ship a pilot",
  "Measure adoption",
  "Review feedback",
  "Refine the rollout",
  "Embed new ways of working",
]

const diagrams = [
  { name: "architecture", prefix: "arch", title: "Mobile can send events directly" },
  { name: "process", prefix: "proc", title: "Eight steps take an idea to launch" },
  { name: "cycle", prefix: "loop", title: "Each release feeds the next plan" },
  ...["technical", "midnight"].flatMap((theme) => [
    {
      name: "matrix",
      prefix: "matrix",
      title: "Invest in the platforms with room to grow",
      theme,
      focus: "upper-right",
    },
    { name: "tree", prefix: "tree", title: "Mobile checkout explains the conversion decline", theme, focus: "mobile" },
  ]),
]

function withExtraLinks(fixture) {
  return {
    ...fixture,
    data: {
      ...fixture.data,
      links: [
        ...fixture.data.links,
        { id: "skip", from: "mobile", to: "events" },
        { id: "lateral", from: "identity", to: "payments" },
      ],
    },
  }
}

async function mcp(kit, opened, tool, args) {
  const response = await fetch(kit.origin + kit.mcpRoutes.mcp.path, {
    method: "POST",
    headers: {
      cookie: opened.cookie,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: `airdesign_${tool}`, arguments: args },
    }),
  })
  kit.expect(response.ok).toBe(true)
  const raw = await response.text()
  const payload = raw.startsWith("{")
    ? raw
    : raw
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6)
  const { result } = JSON.parse(payload)
  return result.structuredContent ?? JSON.parse(result.content[0].text)
}

function remap(tree, prefix) {
  const id = (value) => value.replace(/^component:/, `${prefix}:`)
  const end = (value) => ("node" in value ? { ...value, node: id(value.node) } : value)
  const props = (value) =>
    value.geometry?.kind === "line"
      ? { ...value, geometry: { ...value.geometry, start: end(value.geometry.start), end: end(value.geometry.end) } }
      : value
  return {
    ...tree,
    id: id(tree.id),
    children: tree.children.map((child) => ({ ...child, id: id(child.id), props: props(child.props) })),
  }
}

function lineEnds(saved, line) {
  const { start, end } = saved.nodes[line.id].geometry
  return [start.node, end.node]
}

async function exportPdf(kit, out, name, expectedText) {
  const { page, expect } = kit
  await page.getByRole("button", { name: productCopy.exportDeck, exact: true }).click()
  await page
    .getByRole("dialog", { name: exportCopy.title })
    .getByRole("button", { name: exportCopy.action, exact: true })
    .click()
  const printed = page.locator("[data-print-page]")
  await expect(printed).toHaveCount(1)
  await expect(printed).not.toContainText("…")
  for (const label of expectedText) await expect(printed).toContainText(label)
  await writeFile(join(out, `${name}-print.png`), await printed.screenshot())
  const pdf = await page.pdf({ preferCSSPageSize: true })
  const { pdfPages } = await import("../../../../tests/browser/pdf-file.ts")
  const [first] = pdfPages(pdf)
  expect(first?.box).toEqual([0, 0, 960, 540])
  expect(first?.content).toMatch(/\bT[Jj]\b/)
  expect(first?.content).toMatch(/\b(?:S|f\*?)\b/)
  await writeFile(join(out, `${name}.pdf`), pdf)
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")))
  await expect(printed).toHaveCount(0)
}

async function center(page, id) {
  const box = await page.locator(`[data-slide-box] [data-node="${id}"]`).first().boundingBox()
  if (box === null) throw new Error(`${id} is not painted`)
  const slide = await page.locator("[data-slide-box]").boundingBox()
  const scale = 1920 / slide.width
  return { x: (box.x - slide.x + box.width / 2) * scale, y: (box.y - slide.y + box.height / 2) * scale }
}

export default async function drive(kit) {
  const { page, expect, repo, capture, note } = kit
  const doom = await packageBuild(repo, "@airdesign/doom")
  const component = await packageBuild(repo, "@airdesign/doom", "component/index.js")
  const { FontMetrics } = await packageBuild(repo, "@airdesign/api", "platform/font-metrics.js")
  const { FontSource } = await packageBuild(repo, "@airdesign/api", "platform/font-source.js")
  const fonts = new FontMetrics(new FontSource(fontShelf(shelfFolder)))
  const { landTree } = await packageBuild(repo, "@airdesign/doom", "component/testing/land-tree.js")
  const estimate = doom.measureWith({})
  async function expand(name, fixture, theme) {
    const spec = doom.componentLibrary.get(name).spec
    const estimated = component.expandComponent(spec, { ...fixture, theme, measure: estimate })
    expect(doom.isRefusal(estimated), JSON.stringify(estimated)).toBe(false)
    const served = await fonts.measure([landTree(estimated, theme).doom])
    expect(typeof served).toBe("object")
    expect(served.missing.size + served.pending.size).toBe(0)
    const { measure } = served
    const tree = component.expandComponent(spec, { ...fixture, theme, measure })
    expect(doom.isRefusal(tree), JSON.stringify(tree)).toBe(false)
    return { tree, measure }
  }
  let out

  for (const { id, spec } of doom.componentLibrary.values()) {
    const { w, h, data } = spec.sample
    for (const [themeId, { theme }] of Object.entries(doom.themeLibrary)) {
      const { tree } = await expand(id, { frame: { x: 160, y: 220, w, h }, data }, theme)
      expect(tree.findings, `${id} default sample on ${themeId}`).toEqual([])
    }
  }
  note("Every library sample expanded with zero findings on every built-in theme using served fonts.")

  await page.addInitScript(() => {
    window.print = () => {}
  })
  for (const diagram of diagrams) {
    const themeId = diagram.theme ?? "technical"
    const theme = doom.themeLibrary[themeId].theme
    const artifact = diagram.theme === undefined ? diagram.name : `${diagram.name}-${themeId}`
    const sample = doom.componentLibrary.get(diagram.name).spec.sample
    let fixture =
      diagram.theme === undefined
        ? JSON.parse(await readFile(join(repo, `packages/doom/src/component/testing/${diagram.name}.json`), "utf8"))
        : {
            frame: { x: 160, y: 220, w: sample.w, h: sample.h },
            data: sample.data,
            tokens: artifact === "tree-technical" ? {} : { focus: diagram.focus },
          }
    const expectedText =
      diagram.name === "matrix"
        ? ["Core platform", "Current size", "Future growth", "Bubble size: Revenue"]
        : diagram.name === "tree"
          ? sample.data.nodes.map(({ label }) => label)
          : []
    if (diagram.name === "tree") {
      const nodes = sample.data.nodes.map((node) => (node.id === "mobile" ? { ...node, label: "W".repeat(120) } : node))
      const { tree, measure } = await expand("tree", { ...fixture, data: { nodes } }, theme)
      const part = tree.children.find(({ key }) => key.join("/") === "node/mobile")
      expect(part.props.text.chars).toBe("W".repeat(120))
      expect(tree.findings).toMatchObject([{ kind: "text-fit", key: ["node", "mobile"] }])
      const { doom: fold, slide } = landTree(tree, theme)
      const { lines } = doom.resolveSlide(fold, slide, measure)[0].children.find(({ id }) => id === part.id).text
      expect(
        lines
          .at(-1)
          .runs.map(({ text }) => text)
          .join(""),
      ).toMatch(/…$/)
      note(
        `Issue tree overflow: the served ${themeId} font measure reports the finding and resolves the label with an ellipsis.`,
      )
    }
    if (diagram.name === "matrix") {
      fixture = {
        ...fixture,
        data: {
          ...fixture.data,
          items: fixture.data.items.map((item, index) => ({
            ...item,
            size: [15, 75, 900, 360, 40, 120, 240, 60][index],
          })),
        },
        tokens: { ...fixture.tokens, sizeLabel: "Revenue" },
      }
    }
    if (diagram.name === "architecture") fixture = withExtraLinks(fixture)
    if (diagram.name === "process") {
      for (const direction of ["row", "column"]) {
        const frame = direction === "row" ? fixture.frame : { x: 600, y: 160, w: 720, h: 800 }
        for (let count = 3; count <= 8; count += 1) {
          const steps = Array.from({ length: count }, (_, i) => ({
            id: `s${i}`,
            label: `Step ${i + 1}`,
            description: descriptionExamples[i],
            ...(direction === "column" ? { note: "2 weeks" } : {}),
          }))
          const { tree } = await expand("process", { frame, data: { steps }, variant: { direction } }, theme)
          expect(tree.children).toHaveLength((direction === "column" ? 3 : 2) * count - 1)
          expect(
            tree.findings.filter(({ kind }) => kind === "text-fit"),
            `${direction} ${count}`,
          ).toEqual([])
          expect(tree.findings.map(({ code }) => code)).toEqual(count > 5 ? ["many-steps"] : [])
        }
      }
      const steps = Array.from({ length: 8 }, (_, i) => ({
        id: `s${i}`,
        label: i === 4 ? "W".repeat(120) : `Step ${i + 1}`,
      }))
      const { tree, measure } = await expand("process", { ...fixture, data: { steps } }, theme)
      expect(tree.findings.filter(({ kind }) => kind === "text-fit")).toMatchObject([
        { kind: "text-fit", key: ["step", "s4"] },
      ])
      const { doom: fold, slide } = landTree(tree, theme)
      const part = tree.children.find(({ key }) => key.join("/") === "step/s4")
      const { lines } = doom.resolveSlide(fold, slide, measure)[0].children.find(({ id }) => id === part.id).text
      expect(
        lines
          .at(-1)
          .runs.map(({ text }) => text)
          .join(""),
      ).toMatch(/…$/)
      for (const line of lines) {
        expect(line.ink).toBeLessThanOrEqual(line.w)
        expect(line.y + line.h).toBeLessThanOrEqual(part.props.box.h)
      }
      note(
        "Served Geist: process counts 3–8 fit in both directions with descriptions and column durations. One impossible label retains its full source and paints an ellipsis in bounds.",
      )
    }
    if (diagram.name === "process") {
      const labels = [...fixture.data.steps.map(({ label }) => label), "Review", "Refine", "Track"]
      fixture.data.steps = labels.map((label, i) => ({ id: `s${i}`, label, description: descriptionExamples[i] }))
    }
    const { tree: expanded } = await expand(diagram.name, fixture, theme)
    expect(expanded.findings.filter(({ kind }) => kind === "text-fit")).toEqual([])
    const tree = remap(expanded, diagram.prefix)

    const opened = await openDoomDeck(kit)
    const nodes = (await readDoom(kit, opened)).fold.nodes
    let deck = nodes[opened.slide]
    while (deck.parent !== undefined) deck = nodes[deck.parent.id]
    const themed = await kit.post(
      kit.doomRoutes.edit,
      {
        deck: opened.deck,
        edit: {
          once: `theme-${diagram.name}-${String(Date.now())}`,
          author: { kind: "person", id: "other-tab" },
          writes: [{ node: deck.id, prop: "theme", value: theme }],
        },
      },
      opened.cookie,
    )
    expect(themed.json.ok, JSON.stringify(themed.json)).toBe(true)
    await clickSlide(page, 40, 40)
    await page.keyboard.press("ControlOrMeta+a")
    await page.keyboard.press("Delete")
    await expect
      .poll(async () =>
        Object.values((await readDoom(kit, opened)).fold.nodes).filter((each) => each.parent?.id === opened.slide),
      )
      .toHaveLength(0)
    if (artifact === "matrix-technical") {
      const before = await capture("frameworks-before")
      await writeFile(
        join(dirname(before), "frameworks-before-slide.png"),
        await page.locator("[data-slide-box]").screenshot(),
      )
      const response = await mcp(kit, opened, "read_deck", { deck: opened.deck })
      expect(response.components).toEqual(expect.arrayContaining(["matrix", "tree"]))
    }
    await landNodes(kit, opened, [
      {
        id: `${diagram.prefix}:900`,
        props: { name: diagram.title, box: spot(160, 88, 1600, 80), text: words(diagram.title, { style: "heading" }) },
      },
      tree,
      ...tree.children.map((child) => ({ ...child, parent: tree.id })),
    ])

    const saved = (await readDoom(kit, opened)).fold
    for (const child of tree.children) {
      const stored = saved.nodes[child.id]
      if (child.props.geometry.kind === "line") expect(stored.geometry).toEqual(child.props.geometry)
      else expect(stored.box).toEqual(child.props.box)
      await expect(page.locator(`[data-slide-thumb] [data-node="${child.id}"]`).first()).toBeAttached(slowPaint)
    }
    if (diagram.name === "process" || diagram.name === "tree") {
      const slide = page.locator("[data-slide-box]")
      await expect(slide).not.toContainText("…")
      await expect(page.locator("[data-slide-thumb]").first()).not.toContainText("…")
    }
    for (const label of expectedText) {
      await expect(page.locator("[data-slide-box]")).toContainText(label)
      await expect(page.locator("[data-slide-thumb]").first()).toContainText(label)
    }
    const shot = await capture(`${artifact}-canvas`)
    out = dirname(shot)
    await writeFile(join(out, `${artifact}-slide.png`), await page.locator("[data-slide-box]").screenshot())
    await writeFile(
      join(out, `${artifact}-filmstrip.png`),
      PNG.sync.write(PNG.sync.read(await page.locator("[data-slide-thumb]").first().screenshot())),
    )
    await exportPdf(kit, out, artifact, expectedText)
    note(`${artifact}: saved rows matched the expansion and canvas, filmstrip and PDF painted in ${themeId}.`)

    if (artifact === "tree-technical") {
      const card = tree.children.find(({ key }) => key.join("/") === "node/new")
      const connectors = tree.children.filter(({ key }) => key[0] === "connector")
      const from = await center(page, card.id)
      await page.keyboard.press("Escape")
      await clickSlide(page, from.x, from.y, { modifiers: ["ControlOrMeta"] })
      await expect(page.locator("[data-selection-outline]")).toHaveAttribute("data-selection-outline", card.id)
      await dragSlide(page, from, { x: from.x + 45, y: from.y + 50 })
      await expect
        .poll(async () => (await readDoom(kit, opened)).fold.nodes[card.id].box.x, slowPaint)
        .toBeGreaterThan(card.props.box.x + 20)
      const after = (await readDoom(kit, opened)).fold
      for (const connector of connectors) expect(lineEnds(after, connector)).toEqual(lineEnds(saved, connector))
      await capture("tree-card-moved")
      note("Issue tree: dragging a branch preserves its parent and child attachments.")
    }

    if (diagram.name === "process") {
      const steps = tree.children.filter(({ key }) => key[0] === "step")
      const connectors = tree.children.filter(({ key }) => key[0] === "connector")
      const before = connectors.map((line) => lineEnds(saved, line))
      const from = await center(page, steps[1].id)
      await page.keyboard.press("Escape")
      await openDesign(page)
      await clickSlide(page, from.x, from.y)
      await expect(page.locator("[data-selection-outline]")).toHaveAttribute("data-selection-outline", tree.id)
      await page.locator("[data-design-panel]").getByRole("button", { name: frameCopy.removeAutoLayout }).click()
      await expect.poll(async () => (await readDoom(kit, opened)).fold.nodes[tree.id].layout?.mode).toBe("none")
      await page.keyboard.press("Escape")
      await clickSlide(page, from.x, from.y, { modifiers: ["ControlOrMeta"] })
      await expect(page.locator("[data-selection-outline]")).toHaveAttribute("data-selection-outline", steps[1].id)
      await dragSlide(page, from, { x: from.x + 60, y: from.y + 180 })
      await expect
        .poll(async () => (await readDoom(kit, opened)).fold.nodes[steps[1].id].box.y, slowPaint)
        .toBeGreaterThan(steps[1].props.box.y + 120)
      const after = (await readDoom(kit, opened)).fold
      expect(connectors.map((line) => lineEnds(after, line))).toEqual(before)
      await capture("process-step-moved")
      note("process: after Remove auto layout, dragging step 2 down moves it and both its connectors stay attached.")
    }

    if (diagram.name === "architecture") {
      const gateway = tree.children.find(({ key }) => key.join("/") === "component/gateway")
      const links = tree.children.filter(({ key }) => key[0] === "link")
      const from = await center(page, gateway.id)
      await page.keyboard.press("Escape")
      await clickSlide(page, from.x, from.y, { modifiers: ["ControlOrMeta"] })
      await expect(page.locator("[data-selection-outline]")).toHaveAttribute("data-selection-outline", gateway.id)
      await dragSlide(page, from, { x: from.x + 120, y: from.y + 36 })
      await expect
        .poll(async () => (await readDoom(kit, opened)).fold.nodes[gateway.id].box.x, slowPaint)
        .toBeGreaterThan(gateway.props.box.x + 80)
      const after = (await readDoom(kit, opened)).fold
      for (const link of links) expect(lineEnds(after, link)).toEqual(lineEnds(saved, link))
      await capture("architecture-card-moved")
      note("Architecture: the gateway moved with each connector still attached.")
      const reply = await mcp(kit, opened, "edit_deck", {
        deck: opened.deck,
        base: (await readDoom(kit, opened)).rev,
        changes: [
          {
            op: "set",
            target: gateway.id,
            padding: 28,
            fill: "background2",
            stroke: "accent1",
            strokeWidth: 4,
            radius: 22,
          },
        ],
      })
      expect(reply.ok, JSON.stringify(reply)).toBe(true)
      const agentRead = await mcp(kit, opened, "read_deck", { deck: opened.deck, slide: opened.slide })
      expect(JSON.stringify(agentRead)).toContain("fill=background2 stroke=accent1 strokeWidth=4 radius=22")
      expect(JSON.stringify(agentRead)).toContain("padding=28")
      const painted = (await readDoom(kit, opened)).fold.nodes[gateway.id]
      expect(painted.text.padding).toEqual({ t: 28, r: 28, b: 28, l: 28 })
      await openDesign(page)
      await capture("architecture-card-design")
      note("MCP reads and writes card padding, fill, border and radius through edit_deck and read_deck.")
    }
  }
}
