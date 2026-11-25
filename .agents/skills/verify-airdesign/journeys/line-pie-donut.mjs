import { execFileSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { PNG } from "pngjs"
import { packageBuild } from "../../../../scripts/package-build.mjs"
import { exportCopy, productCopy } from "../bin/product-copy.mjs"
import { clickSlide, landNodes, openDoomDeck, readDoom, words } from "../look/doom-deck.mjs"

const lineData = {
  categories: ["Jan", "Feb", "Mar", "Apr"].map((label) => ({ id: label, label })),
  series: [
    {
      id: "forecast",
      label: "Forecast",
      values: [0, 2.25, -1.2, 10],
      color: { var: "accent3" },
      markers: [null, null, "#a94350"],
    },
    { id: "measured", label: "Measured", values: [1, -1, 3, 8] },
  ],
}

const mix = (rows) => ({
  series: [{ id: "mix" }],
  rows: rows.map(([label, value, color], i) => ({
    id: `s${i}`,
    label,
    value,
    ...(color === undefined ? {} : { color }),
  })),
})

const rgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))

function assertColors(expect, png, minimum, hexes) {
  for (const hex of hexes) {
    const color = rgb(hex)
    let count = 0
    for (let i = 0; i < png.data.length; i += 4)
      if (color.every((channel, c) => Math.abs(png.data[i + c] - channel) <= 3)) count += 1
    expect(count, `paint for ${color}`).toBeGreaterThan(minimum)
  }
}

function assertTraces(expect, png, chart, colorOf) {
  const { x, y } = chart.props.box
  for (const { key, props } of chart.children.filter(({ key }) => key[0] === "trace")) {
    const [[ax, ay], [bx, by]] = props.geometry.d
      .split("L")
      .slice(-2)
      .map((pair) => pair.split(" ").map(Number))
    const px = Math.floor(((x + ((ax + bx) * props.box.w) / 2) * png.width) / 1920)
    const py = Math.floor(((y + ((ay + by) * props.box.h) / 2) * png.height) / 1080)
    const color = rgb(colorOf(props.strokes[0].color))
    let closest = 255
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const offset = ((py + dy) * png.width + px + dx) * 4
        const distance = Math.max(...color.map((channel, c) => Math.abs(png.data[offset + c] - channel)))
        closest = Math.min(closest, distance)
      }
    }
    expect(closest, `trace for ${key[1]}`).toBeLessThan(48)
  }
}

export default async function drive(kit) {
  const { page, expect, repo, capture, note } = kit
  const doom = await packageBuild(repo, "@airdesign/doom")
  const { expandComponent, lineComponent, pieComponent, donutComponent } = await packageBuild(
    repo,
    "@airdesign/doom",
    "component/index.js",
  )
  const { FontMetrics } = await packageBuild(repo, "@airdesign/api", "platform/font-metrics.js")
  const { fontRevision, fontRoutes } = await packageBuild(repo, "@airdesign/fonts")
  const fontUrl = (route, query) => `${kit.origin}${route.path}?${new URLSearchParams(query)}`
  const fonts = {
    family: async (family) => (await fetch(fontUrl(fontRoutes.family, { family }))).json(),
    file: async (family, file) => {
      const response = await fetch(fontUrl(fontRoutes.file, { family, file, v: fontRevision }))
      return response.ok ? Buffer.from(await response.arrayBuffer()) : undefined
    },
  }
  await page.addInitScript(() => {
    window.print = () => {}
  })
  const opened = await openDoomDeck(kit)
  const { fold } = await readDoom(kit, opened)
  const theme = Object.values(fold.nodes).find((node) => node.theme !== undefined)?.theme
  expect(theme).toBeDefined()
  const metricText =
    "Jan Feb Mar Apr Forecast Measured Net growth Revenue mix Channel mix Core New Other Direct Partner Field Pilot Service Channel −<+0123456789.,%·"
  const measuring = doom.doomFromTree({
    theme,
    slides: [
      {
        children: ["caption", "label"].map((style) => ({
          type: "shape",
          props: { text: words(metricText, { style }) },
        })),
      },
    ],
  })
  const metrics = await new FontMetrics(fonts, Date.now, () => {}).measure([measuring.doom])
  expect(typeof metrics).toBe("object")
  expect([...metrics.missing]).toEqual([])

  const fixtures = [
    [lineComponent, lineData, { x: 230, y: 30, w: 1460, h: 475 }, { title: "Net growth", digits: 1 }, { labels: true }],
    [
      pieComponent,
      mix([
        ["Core", 8],
        ["New", 6, { var: "accent6" }],
        ["Service", 5],
        ["Partner", 4],
        ["Channel", 3],
        ["Field", 2],
        ["Pilot", 1],
      ]),
      { x: 136, y: 540, w: 700, h: 480 },
      { title: "Revenue mix" },
      {},
    ],
    [
      donutComponent,
      mix([
        ["Direct", 59],
        ["Partner", 35],
        ["Field", 5],
        ["Pilot", 1],
      ]),
      { x: 1000, y: 527, w: 810, h: 510 },
      { title: "Channel mix" },
      {},
    ],
  ]
  const trees = fixtures.map(([spec, data, frame, tokens, variant], i) => {
    const tree = expandComponent(spec, { data, frame, tokens, variant, theme, measure: metrics.measure })
    expect(doom.isRefusal(tree), JSON.stringify(tree)).toBe(false)
    const id = (value) => value.replace("component", `chart${i}`)
    return {
      ...tree,
      id: id(tree.id),
      children: tree.children.map((child) => ({ ...child, id: id(child.id), parent: id(tree.id) })),
    }
  })

  const colorOf = (color) => doom.resolveColor(color, theme)
  const pieParts = trees[1].children
  const fills = pieParts.filter(({ key }) => key[0] === "slice").map(({ props }) => colorOf(props.fills[0].color))
  expect(pieParts.filter(({ key }) => key[0] === "legend")).toHaveLength(6)
  expect(pieParts.filter(({ key }) => key[0] === "swatch")).toHaveLength(6)

  await clickSlide(page, 50, 50)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Delete")
  await expect
    .poll(async () =>
      Object.values((await readDoom(kit, opened)).fold.nodes).filter((node) => node.parent?.id === opened.slide),
    )
    .toHaveLength(0)
  const before = dirname(await capture("before-expansion"))
  await writeFile(join(before, "before-canvas.png"), await page.locator("[data-slide-box]").screenshot())
  await landNodes(kit, opened, trees)
  for (const tree of trees) await landNodes(kit, opened, tree.children)
  const saved = (await readDoom(kit, opened)).fold
  const canvas = page.locator("[data-slide-box]")
  const filmstrip = page.locator("[data-slide-thumb]").first()
  for (const child of trees.flatMap(({ children }) => children)) {
    expect(saved.nodes[child.id].geometry).toEqual(child.props.geometry)
    if (child.props.text !== undefined) {
      expect(saved.nodes[child.id].text.chars).toBe(child.props.text.chars)
      await expect(canvas.locator(`[data-node="${child.id}"]`)).toContainText(child.props.text.chars)
    }
    const thumbNode = filmstrip.locator(`[data-node="${child.id}"]`)
    await expect(thumbNode).toBeAttached()
    if (child.key[0] === "trace") {
      expect(saved.nodes[child.id].stroke).toEqual(child.props.stroke)
      await expect(thumbNode.locator("[data-strokes] path")).toHaveAttribute(
        "stroke-width",
        String(child.props.stroke.weight),
      )
    }
  }
  const out = dirname(await capture("line-pie-donut"))
  const painted = await canvas.screenshot()
  const thumbnail = await filmstrip.screenshot()
  await writeFile(join(out, "canvas.png"), painted)
  await writeFile(join(out, "filmstrip.png"), thumbnail)
  const canvasPng = PNG.sync.read(painted)
  assertTraces(expect, canvasPng, trees[0], colorOf)
  assertColors(expect, canvasPng, 20, fills)
  assertColors(expect, PNG.sync.read(thumbnail), 8, fills)

  await page.getByRole("button", { name: productCopy.exportDeck, exact: true }).click()
  await page
    .getByRole("dialog", { name: exportCopy.title })
    .getByRole("button", { name: exportCopy.action, exact: true })
    .click()
  await expect(page.locator("[data-print-page]")).toHaveCount(1)
  const pdf = join(out, "charts.pdf")
  await writeFile(pdf, await page.pdf({ preferCSSPageSize: true }))
  execFileSync("pdftoppm", ["-r", "144", "-png", "-singlefile", pdf, join(out, "pdf")])
  const pdfPng = PNG.sync.read(await readFile(join(out, "pdf.png")))
  assertTraces(expect, pdfPng, trees[0], colorOf)
  assertColors(expect, pdfPng, 20, fills)
  const images = execFileSync("pdfimages", ["-list", pdf], { encoding: "utf8" }).trimEnd().split("\n").slice(2)
  expect(images).toHaveLength(0)
  const extracted = execFileSync("pdftotext", [pdf, "-"], { encoding: "utf8" })
  for (const label of [
    "Forecast",
    "Measured",
    "Net growth",
    "Revenue mix",
    "Channel mix",
    "Pilot",
    "Core",
    "New",
    "Service",
    "Partner",
    "Channel",
    "Other",
  ])
    expect(extracted).toContain(label)
  note(
    "Expanded all three built-in specs with served font metrics, read the saved layer geometry and labels, and checked their paint on the canvas, filmstrip and exported PDF.",
  )
}
