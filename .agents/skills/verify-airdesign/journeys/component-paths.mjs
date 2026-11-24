import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { PNG } from "pngjs"
import { packageBuild } from "../../../../scripts/package-build.mjs"
import { exportCopy, productCopy } from "../bin/product-copy.mjs"
import { clickSlide, landNodes, openDoomDeck, readDoom } from "../look/doom-deck.mjs"

const pixels = [
  ["pie interior", 280, 525, [32, 58, 102]],
  ["pie sector", 405, 445, [96, 145, 210]],
  ["pie corner", 197, 377, [255, 255, 255]],
  ["donut interior", 745, 545, [32, 58, 102]],
  ["donut sector", 940, 440, [96, 145, 210]],
  ["rounded line join", 1551, 599, [32, 58, 102]],
  ["donut hole", 870, 540, [255, 255, 255]],
  ["polyline stroke", 1295, 540, [32, 58, 102]],
  ["polyline interior", 1420, 495, [255, 255, 255]],
  ["rise marker", 1389, 432, [96, 145, 210]],
]

function checkPixels(expect, { width, height, data }, samples, tolerance) {
  for (const [label, x, y, color] of samples) {
    const at = (Math.round((y * height) / 1080) * width + Math.round((x * width) / 1920)) * 4
    const actual = data.slice(at, at + 3)
    expect(Math.max(...color.map((channel, i) => Math.abs(channel - actual[i]))), `${label}: ${actual}`).toBeLessThan(
      tolerance,
    )
  }
}

export default async function drive(kit) {
  const { page, expect, repo, capture, note } = kit
  const doom = await packageBuild(repo, "@airdesign/doom")
  const { readComponentSpec, expandComponent } = await packageBuild(repo, "@airdesign/doom", "component/index.js")
  const spec = readComponentSpec(
    JSON.parse(await readFile(join(repo, "packages/doom/src/component/testing/paths.json"), "utf8")),
  )
  expect(doom.isRefusal(spec), JSON.stringify(spec)).toBe(false)
  const tree = expandComponent(spec, {
    data: {},
    frame: { x: 0, y: 0, w: 1920, h: 1080 },
    theme: doom.defaultTheme,
    measure: doom.measureWith({}),
  })
  expect(doom.isRefusal(tree), JSON.stringify(tree)).toBe(false)

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
  await landNodes(kit, opened, [tree, ...tree.children.map((child) => ({ ...child, parent: tree.id }))])
  const saved = (await readDoom(kit, opened)).fold
  const fold = doom.readFold(saved)
  const savedKey = createHash("sha256").update(doom.slideKeyText(fold, opened.slide)).digest("hex")
  for (const child of tree.children) {
    expect(saved.nodes[child.id].geometry).toEqual(child.props.geometry)
    await expect(page.locator(`[data-slide-thumb] [data-node="${child.id}"]`).first()).toBeAttached()
  }

  const overview = await capture("path-fixture")
  const canvas = page.locator("[data-slide-box]")
  const painted = PNG.sync.read(await canvas.screenshot())
  checkPixels(expect, painted, pixels, 18)
  for (const [x, y] of [
    [410, 576],
    [990, 627],
  ]) {
    const offset =
      (Math.floor((y * painted.height) / 1080) * painted.width + Math.floor((x * painted.width) / 1920)) * 4
    expect(painted.data[offset], "slice boundary should have no white seam").toBeLessThan(110)
  }
  const thumbnail = page.locator("[data-slide-thumb]").first()
  const thumb = PNG.sync.read(await thumbnail.screenshot())
  checkPixels(
    expect,
    thumb,
    pixels.filter(([label]) => !["polyline stroke", "rise marker", "rounded line join"].includes(label)),
    24,
  )
  await writeFile(join(dirname(overview), "filmstrip.png"), PNG.sync.write(thumb))

  const captured = page.waitForResponse(
    (response) => {
      if (new URL(response.url()).pathname !== kit.doomRoutes.pictures.path || !response.ok()) return false
      return response
        .request()
        .postDataJSON()
        .pictures.images.some(({ key }) => key === savedKey)
    },
    { timeout: 15_000 },
  )
  await Promise.all([
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
        params: { name: "airdesign_read_deck", arguments: { deck: opened.deck, slide: opened.slide, picture: true } },
      }),
    }).then(async (response) => expect(response.ok, await response.text()).toBe(true)),
  ])
  const pictured = await captured
  expect((await pictured.json()).ok).toBe(true)
  const picture = pictured
    .request()
    .postDataJSON()
    .pictures.images.find(({ key }) => key === savedKey)
  const jpeg = await page.evaluate(async ({ data, type }) => {
    const image = await createImageBitmap(await (await fetch(`data:${type};base64,${data}`)).blob())
    const canvas = new OffscreenCanvas(image.width, image.height)
    const ctx = canvas.getContext("2d")
    ctx.drawImage(image, 0, 0)
    return {
      width: image.width,
      height: image.height,
      data: Array.from(ctx.getImageData(0, 0, image.width, image.height).data),
    }
  }, picture)
  checkPixels(
    expect,
    jpeg,
    pixels.filter(([label]) => label !== "rounded line join"),
    36,
  )
  await writeFile(join(dirname(overview), "slide-capture.jpg"), Buffer.from(picture.data, "base64"))

  await page.getByRole("button", { name: productCopy.exportDeck, exact: true }).click()
  await page
    .getByRole("dialog", { name: exportCopy.title })
    .getByRole("button", { name: exportCopy.action, exact: true })
    .click()
  await expect(page.locator("[data-print-page]")).toHaveCount(1)
  const pdf = await page.pdf({ preferCSSPageSize: true })
  const { pdfPages } = await import("../../../../tests/browser/pdf-file.ts")
  const [printed] = pdfPages(pdf)
  expect(printed?.box).toEqual([0, 0, 960, 540])
  expect(printed?.content).toMatch(/\bc\b/)
  expect(printed?.content).toMatch(/\b(?:S|f\*?)\b/)
  await writeFile(join(dirname(overview), "path-fixture.pdf"), pdf)
  note("Canvas, filmstrip, saved rows, JPEG and PDF checked for the generated geometry.")
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")))
  await expect(page.locator("[data-print-page]")).toHaveCount(0)

  for (const [label, x, y, expected] of [
    ["donut-hole", 870, 540],
    ["pie-outside", 197, 377],
    ["polyline-outside", 1420, 495],
    ["pie-sector", 405, 445, "pie-sector"],
    ["donut-ring", 745, 545, "donut"],
    ["stroke-hit", 1295, 540, "polyline"],
    ["marker-hit", 1389, 432, "marker"],
  ]) {
    await page.keyboard.press("Escape")
    await clickSlide(page, x, y, { modifiers: ["ControlOrMeta"] })
    const selection = page.locator("[data-selection-outline]")
    if (label === "donut-hole" || label === "stroke-hit") await capture(label)
    if (expected === undefined) await expect(selection, label).toHaveCount(0)
    else {
      const child = tree.children.find(({ key }) => key[0] === expected && (expected !== "marker" || key[1] === "rise"))
      await expect(selection, label).toHaveAttribute("data-selection-outline", child.id)
    }
  }
  note(
    "The donut hole, pie corner and open line interior fall through. The visible sector, ring, line and marker select.",
  )
}
