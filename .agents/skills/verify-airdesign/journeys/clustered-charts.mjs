import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { PNG } from "pngjs"
import { fontShelf, shelfFolder } from "../../../../scripts/font-shelf.mjs"
import { packageBuild } from "../../../../scripts/package-build.mjs"
import { designCopy, exportCopy, productCopy } from "../bin/product-copy.mjs"
import { openDoomDeck, landNodes, readDoom } from "../look/doom-deck.mjs"
import { emptySlide } from "../look/doom-slides.mjs"

const frame = { x: 160, y: 140, w: 1600, h: 780, rotation: 0, flipH: false, flipV: false }
const bar = {
  kind: "bar",
  categories: ["North", "South", "West"],
  series: [
    { name: "Plan", values: [62, -35.5, 0], color: "#345678" },
    { name: "Actual", values: [74.25, -19, 12], points: [{ at: 1, color: { var: "accent5" } }] },
  ],
  labels: true,
  unit: designCopy.percent,
}
const column = {
  kind: "column",
  categories: ["Q1", "Q2", "Q3", "Q4"],
  series: [
    {
      name: "Revenue",
      values: [-12.345, 0, 48.2, 1250],
      color: { var: "accent2", tint: 0.15 },
      points: [{ at: 0, color: "#ab3456" }],
    },
    { name: "Prior year", values: [-24.5, 18, 86.25, 1086] },
    { name: "Plan", values: [32.6, 141.25, 260, 1310] },
  ],
  labels: true,
  unit: "$M",
}

function checkFrame(box) {
  for (const x of [0, box.w]) {
    for (const y of [0, box.h]) {
      const [projectedX, projectedY] = projected(box, { x, y, w: 0, h: 0 })
      assert.ok(projectedX >= 0 && projectedX <= 1920)
      assert.ok(projectedY >= 0 && projectedY <= 1080)
    }
  }
}

function dataOf(chart) {
  return {
    categories: chart.categories.map((label, i) => ({ id: `c${i}`, label })),
    series: chart.series.map(({ name, color, points, values }, i) => ({
      id: `s${i}`,
      label: name,
      fill: color ?? null,
      values,
      fills: chart.categories.map((_, at) => points?.find((point) => point.at === at)?.color ?? null),
    })),
  }
}

function projected(frame, part) {
  const angle = (frame.rotation * Math.PI) / 180
  const dx = part.x + part.w / 2 - frame.w / 2
  const dy = part.y + part.h / 2 - frame.h / 2
  return [
    frame.x + frame.w / 2 + Math.cos(angle) * dx - Math.sin(angle) * dy,
    frame.y + frame.h / 2 + Math.sin(angle) * dx + Math.cos(angle) * dy,
  ]
}

function rgb(hex) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
}

function checkPixels(png, parts, limit) {
  for (const { label, x, y, color } of parts) {
    const at = (Math.round((y * png.height) / 1080) * png.width + Math.round((x * png.width) / 1920)) * 4
    const actual = [...png.data.slice(at, at + 3)]
    assert.ok(
      Math.max(...color.map((channel, i) => Math.abs(channel - actual[i]))) <= limit,
      `${label} at ${x},${y}: wanted ${color} got ${actual}`,
    )
  }
}

export default async function drive(kit) {
  const { repo, page, expect, capture, note } = kit
  const doom = await packageBuild(repo, "@airdesign/doom")
  const { clusteredChartComponent, expandComponent } = await packageBuild(repo, "@airdesign/doom", "component/index.js")
  const { FontSource } = await packageBuild(repo, "@airdesign/api", "platform/font-source.js")
  const { FontMetrics } = await packageBuild(repo, "@airdesign/api", "platform/font-metrics.js")
  const fonts = new FontMetrics(new FontSource(fontShelf(shelfFolder)))
  const dense = {
    ...bar,
    categories: Array.from({ length: 33 }, (_, i) => `Market ${i + 1}`),
    series: bar.series.map((series, i) => ({
      ...series,
      values: Array.from({ length: 33 }, (_, j) => ((i * 37 + j * 17) % 125) - 41.5),
    })),
  }
  const scenarios = [
    { slug: "bar", title: "Share by region", expected: "74", chart: bar, box: frame },
    { slug: "column", title: "Revenue by quarter", expected: "1,250", chart: column, box: frame },
    {
      slug: "transformed-bar",
      title: "Share by region",
      expected: "74",
      chart: bar,
      box: { ...frame, y: 165, h: 750, rotation: 12, flipH: true },
    },
    { slug: "dense-bar", title: "Share by market", chart: dense, box: frame },
  ]
  await page.addInitScript(() => {
    window.print = () => {}
  })
  for (const { slug, title, expected, chart, box } of scenarios) {
    checkFrame(box)
    const opened = await openDoomDeck(kit)
    await emptySlide(kit, opened)
    const canvas = page.locator("[data-slide-box]")
    const thumb = page.locator("[data-slide-thumb]").first()

    const { theme } = doom.deckOf(doom.readFold((await readDoom(kit, opened)).fold))
    const options = {
      data: dataOf(chart),
      frame: { x: box.x, y: box.y, w: box.w, h: box.h },
      theme,
      variant: { orientation: chart.kind, labels: chart.labels },
      tokens: { title, unitHeader: chart.unit, source: "Demo figures" },
    }
    const preliminary = expandComponent(clusteredChartComponent, { ...options, measure: doom.measureWith({}) })
    assert.ok(!doom.isRefusal(preliminary), JSON.stringify(preliminary))
    const texts = [
      title,
      chart.unit,
      ...chart.categories,
      ...chart.series.map(({ name }) => name),
      ...preliminary.children.flatMap(({ props }) => (props.text === undefined ? [] : [props.text.chars])),
      "−0123456789.,",
    ]
    const faces = [...new Set(Object.values(theme.fonts))].flatMap((font) =>
      [false, true].map((bold) => ({ font, bold, italic: false })),
    )
    const widths = await fonts.widths({ faces, texts })
    assert.equal(widths.pending.size, 0)
    const measure = doom.measureWith(widths.widths)
    const tree = expandComponent(clusteredChartComponent, { ...options, measure })
    assert.ok(!doom.isRefusal(tree), JSON.stringify(tree))
    const caption = tree.children.find(({ key }) => key[0] === "unit")
    expect(caption.props.text.chars).toBe(chart.unit)
    expect(tree.children.find(({ key }) => key[0] === "title").props.text.chars).toBe(title)
    expect(tree.children.some(({ key }) => key[0] === "source")).toBe(true)
    const roles = new Set(tree.children.map(({ key }) => key[0]))
    expect(roles.has("tick")).toBe(slug === "dense-bar")
    expect(roles.has("value")).toBe(slug !== "dense-bar")
    if (expected !== undefined) expect(tree.children.some(({ props }) => props.text?.chars === expected)).toBe(true)
    if (slug === "column") {
      const q4 = tree.children.filter(({ key }) => key[0] === "value" && key[1] === "c3")
      expect(q4).toHaveLength(3)
      const spans = q4.map(({ props: { box, text } }) => {
        const { w } = measure(text, theme, null)
        const center = box.x + box.w / 2
        return { left: center - w / 2, right: center + w / 2 }
      })
      const gaps = spans.slice(1).map(({ left }, i) => left - spans[i].right)
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(8 - 1e-6)
      note(`Column Q4 label clearance: ${gaps.map((gap) => gap.toFixed(1)).join(", ")} px.`)
    }
    if (slug === "dense-bar") {
      expect(tree.findings).toContainEqual(
        expect.objectContaining({ key: ["categories"], thinned: expect.any(Number) }),
      )
      expect(tree.findings).toContainEqual(expect.objectContaining({ key: ["value-label-space"], kind: "check" }))
    }

    const root = { ...tree, props: { ...tree.props, box } }
    await landNodes(kit, opened, [root, ...tree.children.map((child) => ({ ...child, parent: tree.id }))])
    const saved = (await readDoom(kit, opened)).fold
    expect(saved.nodes[tree.id].box).toEqual(box)
    for (const child of tree.children) expect(saved.nodes[child.id]).toMatchObject(child.props)
    const ids = tree.children.map(({ id }) => id).sort()
    for (const surface of [canvas, thumb]) {
      await expect
        .poll(async () =>
          surface
            .locator("[data-node]")
            .evaluateAll(
              (nodes, keys) =>
                [
                  ...new Set(nodes.map((node) => node.getAttribute("data-node")).filter((id) => keys.includes(id))),
                ].sort(),
              ids,
            ),
        )
        .toEqual(ids)
    }
    const evidence = dirname(await capture(`${slug}-after`))
    const afterImage = join(evidence, `${slug}-after-canvas.png`)
    const filmstripImage = join(evidence, `${slug}-filmstrip.png`)
    const marks = tree.children.filter(
      ({ key, props }) => key[0] === "bar" && props.box.w >= 20 && props.box.h >= (slug === "dense-bar" ? 6 : 14),
    )
    const samples = marks.map(({ key, props }) => {
      const [x, y] = projected(box, props.box)
      return {
        label: key.join("/"),
        x,
        y,
        large: props.box.w >= 45 && props.box.h >= 45,
        color: rgb(doom.resolveColor(props.fills[0].color, theme)),
      }
    })
    assert.ok(samples.length >= 2)
    checkPixels(PNG.sync.read(await canvas.screenshot({ path: afterImage })), samples, 12)
    const thumbnail = PNG.sync.read(await thumb.screenshot({ path: filmstripImage }))
    const thumbSamples = samples.filter(({ large }) => large)
    if (slug !== "dense-bar") {
      assert.ok(thumbSamples.length >= 2)
      checkPixels(thumbnail, thumbSamples, 38)
    }

    if (slug === "bar" || slug === "column") {
      const fold = doom.readFold(saved)
      const key = createHash("sha256").update(doom.slideKeyText(fold, opened.slide)).digest("hex")
      const captured = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === kit.doomRoutes.pictures.path &&
          response.ok() &&
          response
            .request()
            .postDataJSON()
            .pictures.images.some((image) => image.key === key),
        { timeout: 15000 },
      )
      const [response] = await Promise.all([
        captured,
        fetch(`${kit.origin}${kit.mcpRoutes.mcp.path}`, {
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
            params: {
              name: "airdesign_read_deck",
              arguments: { deck: opened.deck, slide: opened.slide, picture: true },
            },
          }),
        }).then((response) => assert.ok(response.ok)),
      ])
      const picture = response
        .request()
        .postDataJSON()
        .pictures.images.find((image) => image.key === key)
      const capturePath = join(evidence, `${slug}-capture.jpg`)
      await writeFile(capturePath, Buffer.from(picture.data, "base64"))
      const pixels = await page.evaluate(
        async ({ type, data, points }) => {
          const bitmap = await createImageBitmap(await (await fetch(`data:${type};base64,${data}`)).blob())
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
          const ctx = canvas.getContext("2d", { willReadFrequently: true })
          ctx.drawImage(bitmap, 0, 0)
          return points.map(({ x, y }) => {
            const px = Math.round((x * bitmap.width) / 1920)
            const py = Math.round((y * bitmap.height) / 1080)
            return [...ctx.getImageData(px, py, 1, 1).data.slice(0, 3)]
          })
        },
        { ...picture, points: samples.map(({ x, y }) => ({ x, y })) },
      )
      for (const [i, { label, color }] of samples.entries()) {
        const actual = pixels[i]
        assert.ok(
          Math.max(...color.map((channel, at) => Math.abs(channel - actual[at]))) <= 38,
          `${label} capture: wanted ${color} got ${actual}`,
        )
      }
    }

    await page.getByRole("button", { name: productCopy.exportDeck, exact: true }).click()
    await page
      .getByRole("dialog", { name: exportCopy.title })
      .getByRole("button", { name: exportCopy.action, exact: true })
      .click()
    await expect(page.locator("[data-print-page]")).toHaveCount(1)
    const pdfPath = join(evidence, `${slug}.pdf`)
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true })
    const raster = join(evidence, `${slug}-pdf`)
    execFileSync("pdftoppm", ["-r", "144", "-png", "-singlefile", pdfPath, raster])
    checkPixels(PNG.sync.read(await readFile(`${raster}.png`)), samples, 12)
    if (expected !== undefined && slug !== "transformed-bar")
      expect(execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf-8" })).toContain(expected)
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")))
    await expect(page.locator("[data-print-page]")).toHaveCount(0)
    const captureCount = slug === "bar" || slug === "column" ? samples.length : 0
    note(
      `${slug}: ${samples.length} mark centres matched on canvas and PDF. ${thumbSamples.length} large mark centres matched in the filmstrip. ${captureCount} matched in slide capture. ${tree.children.length} ordinary parts read back. ${tree.findings.map((finding) => `${finding.key.join("/")}: ${finding.kind === "check" ? finding.message : (finding.thinned ?? "omit")}`).join(", ") || "No fit findings."}`,
    )
  }
}
