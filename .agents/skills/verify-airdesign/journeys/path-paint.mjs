import { execFileSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { PNG } from "pngjs"
import { packageBuild } from "../../../../scripts/package-build.mjs"
import { exportCopy, productCopy } from "../bin/product-copy.mjs"
import { clickSlide, landNodes, openDoomDeck, readDoom, spot } from "../look/doom-deck.mjs"

const colors = ["#d7263d", "#2e933c", "#1b98e0", "#f2c14e", "#8338ec"]
const blue = "#336699"
const pieSize = 300
const cases = ["opaque", "node", "fill", "ancestor"]
const center = (index, control = false) => [190 + 460 * index, control ? 500 : 170]

const paint = (color, opacity = 1) => ({ kind: "solid", color, opacity })
const wedge = (key, x, y, size, from, to, r0) => ({
  emit: {
    kind: "path",
    key: ["list", key],
    x,
    y,
    w: size,
    h: size,
    fill: blue,
    d: ["wedge", ["point", 0.5, 0.5], r0, 0.5, from, to],
  },
})

function pies() {
  return cases.flatMap((mode, index) =>
    [false, true].flatMap((control) => {
      const [x, y] = center(index, control)
      return colors.map((color, i) => ({
        ...wedge(`pie-${mode}-${control}-${i}`, x - pieSize / 2, y - pieSize / 2, pieSize, i / 5, (i + 1) / 5, 0),
        color,
        mode,
        control,
      }))
    }),
  )
}

const sweepSize = 80
const sweepGrid = Array.from({ length: 80 }, (_, i) => {
  const x = 8 + (i % 20) * 96
  const y = 660 + Math.floor(i / 20) * 100
  const delta = (i % 40) * 4e-9
  const direction = i < 40 ? 1 : -1
  return { x, y, delta, direction, start: i < 40 ? 0.125 : 0.625, inner: i < 40 ? 0 : 0.29 }
})

function rgb(png, x, y) {
  const at = (Math.floor((y * png.height) / 1080) * png.width + Math.floor((x * png.width) / 1920)) * 4
  return Array.from(png.data.subarray(at, at + 3))
}

function seamDistance(pixel, left, right) {
  const spread = right.map((c, i) => c - left[i])
  const projection = spread.reduce((sum, c, i) => sum + c * (pixel[i] - left[i]), 0)
  const t = Math.min(1, Math.max(0, projection / spread.reduce((sum, c) => sum + c ** 2, 0)))
  return Math.hypot(...spread.map((c, i) => pixel[i] - left[i] - c * t))
}

function seamScore(png, x, y) {
  let worst = 0
  for (let i = 1; i < colors.length; i++) {
    const angle = (i * 2 * Math.PI) / colors.length
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    for (const r of [40, 70, 100, 130]) {
      const at = (offset) => rgb(png, x + cos * r - sin * offset, y + sin * r + cos * offset)
      for (let offset = -1.5; offset <= 1.5; offset += 0.5) {
        worst = Math.max(worst, seamDistance(at(offset), at(-6), at(6)))
      }
    }
  }
  return worst
}

function checkPaint(kit, name, png) {
  const scores = cases.map((mode, i) => ({
    mode,
    score: seamScore(png, ...center(i)),
    control: seamScore(png, ...center(i, true)),
  }))
  kit.note(
    `${name} seams (worst RGB distance): ${scores.map(({ mode, score, control }) => `${mode} ${score.toFixed(1)} / control ${control.toFixed(1)}`).join(", ")}.`,
  )
  const missing = sweepGrid.filter(({ x, y, inner }) =>
    Array.from({ length: 8 }, (_, i) => ((i + 0.5) / 8) * 2 * Math.PI).some((angle) =>
      (inner === 0 ? [13, 32] : [32]).some((r) => {
        const [red, green, blue] = rgb(png, x + 40 + r * Math.cos(angle), y + 40 + r * Math.sin(angle))
        return Math.hypot(red - 51, green - 102, blue - 153) > 12
      }),
    ),
  )
  kit.note(
    `${name} missing near-full wedges: ${missing.map(({ delta, direction }) => `${delta} (${direction})`).join(", ") || "none"}.`,
  )
  return { scores, missing }
}

export default async function drive(kit) {
  const { page, expect, repo, note } = kit
  const doom = await packageBuild(repo, "@airdesign/doom")
  const { expandComponent, readComponentSpec } = await packageBuild(repo, "@airdesign/doom", "component/index.js")
  const slices = pies()
  const parts = [
    ...slices,
    ...sweepGrid.map(({ x, y, start, delta, direction, inner }, i) =>
      wedge(`arc-${i}`, x, y, sweepSize, start, start + direction * (1 - delta), inner),
    ),
  ]
  const trees = [parts.slice(0, 60), parts.slice(60)].map((batch, i) => {
    const spec = readComponentSpec({
      version: 1,
      name: "Path paint",
      collections: {},
      parts: batch.map(({ emit }) => ({ emit })),
    })
    expect(doom.isRefusal(spec), JSON.stringify(spec)).toBe(false)
    const tree = expandComponent(spec, {
      data: {},
      frame: { x: 0, y: 0, w: 1920, h: 1080 },
      theme: doom.defaultTheme,
      measure: doom.measureWith({}),
    })
    expect(doom.isRefusal(tree), JSON.stringify(tree)).toBe(false)
    return {
      ...tree,
      id: `paint${i}:1`,
      children: tree.children.map((child, j) => ({ ...child, id: `paint${i}:${j + 2}` })),
    }
  })
  const [first] = trees
  const byKey = new Map(slices.map((slice) => [slice.emit.key[1], slice]))
  const frame = {
    id: "translucent:1",
    type: "frame",
    parent: first.id,
    props: { box: spot(0, 0, 1920, 1080), opacity: 0.5 },
  }
  const nodes = trees.flatMap((tree) =>
    tree.children.map((child) => {
      const slice = byKey.get(child.key[0])
      if (!slice) return { ...child, parent: tree.id }
      const { mode, color, control } = slice
      return {
        ...child,
        parent: mode === "ancestor" ? frame.id : tree.id,
        props: {
          ...child.props,
          geometry: { ...child.props.geometry, fillStroke: !control },
          fills: [paint(color, mode === "fill" ? 0.5 : 1)],
          opacity: mode === "node" ? 0.5 : 1,
        },
      }
    }),
  )

  await page.addInitScript(() => {
    window.print = () => {}
  })
  const opened = await openDoomDeck(kit)
  await clickSlide(page, 50, 50)
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("Delete")
  await expect
    .poll(async () =>
      Object.values((await readDoom(kit, opened)).fold.nodes).filter((node) => node.parent?.id === opened.slide),
    )
    .toHaveLength(0)
  await landNodes(kit, opened, [...trees, frame])
  for (let i = 0; i < nodes.length; i += 30) await landNodes(kit, opened, nodes.slice(i, i + 30))
  const canvas = await page.locator("[data-slide-box]").screenshot()
  const out = dirname(await kit.capture("path-paint"))
  await writeFile(join(out, "canvas.png"), canvas)

  await page.getByRole("button", { name: productCopy.exportDeck, exact: true }).click()
  await page
    .getByRole("dialog", { name: exportCopy.title })
    .getByRole("button", { name: exportCopy.action, exact: true })
    .click()
  await expect(page.locator("[data-print-page]")).toHaveCount(1)
  const pdfPath = join(out, "slide.pdf")
  const raster = join(out, "pdf")
  await writeFile(pdfPath, await page.pdf({ preferCSSPageSize: true }))
  execFileSync("pdftoppm", ["-r", "144", "-png", "-singlefile", pdfPath, raster])
  const results = [
    ["Canvas", checkPaint(kit, "Canvas", PNG.sync.read(canvas))],
    ["PDF", checkPaint(kit, "PDF", PNG.sync.read(await readFile(raster + ".png")))],
  ]
  for (const [name, { scores, missing }] of results) {
    expect.soft(missing, `${name} near-full discs and rings`).toHaveLength(0)
    for (const { mode, score, control } of scores) {
      const limit = mode === "opaque" ? 4 : mode === "ancestor" ? control + 3 : Math.min(20, control + 3)
      expect.soft(score, `${name} ${mode} seam; no-stroke control ${control.toFixed(1)}`).toBeLessThanOrEqual(limit)
    }
  }
  note("The same near-full grid and opacity controls were read from the slide canvas and the rasterized PDF.")
}
