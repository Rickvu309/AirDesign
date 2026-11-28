import { createRequire } from "node:module"
import { expect } from "@playwright/test"
import { connectOutsideAgent } from "./aira-panel.mjs"
import { openDoomDeck } from "../look/doom-deck.mjs"

const { deckViewCopy } = createRequire(import.meta.url)("../../../../apps/web/src/copy/deck-view-copy.ts")

const built = (slide) => `
const s = insert({ kind: "slide", after: ${JSON.stringify(slide)} })
insert({ parent: s, kind: "text", textStyle: "title", text: "Renewals carried the quarter", box: { x: 120, y: 80, w: 1680, h: 140 } })
const rows = [["Renewals", 61], ["New logos", 37], ["Expansion", 22]]
rows.forEach(([label, value], i) => {
  const y = 320 + i * 160
  insert({ parent: s, kind: "text", textStyle: "body", text: label, alignV: "center", box: { x: 120, y, w: 300, h: 112 } })
  insert({ parent: s, kind: "shape", shape: "rect", name: label, fill: i === 0 ? "accent1" : "background2", box: { x: 440, y: y + 20, w: Math.round(1100 * value / 61), h: 72 } })
})
insert({ parent: s, kind: "text", textStyle: "caption", text: "Source: Q3 revenue report", box: { x: 120, y: 960, w: 1200, h: 48 } })
s`

function imageOf(answer) {
  const images = answer.content.filter((block) => block.type === "image")
  expect(images, JSON.stringify(answer.structuredContent)).toHaveLength(1)
  return images[0].data
}

async function difference(page, first, second) {
  return page.evaluate(
    async ([one, two]) => {
      const pixels = async (data) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${data}`)).blob())
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext("2d")
        context.drawImage(bitmap, 0, 0)
        return {
          width: bitmap.width,
          height: bitmap.height,
          data: context.getImageData(0, 0, bitmap.width, bitmap.height).data,
        }
      }
      const [a, b] = await Promise.all([pixels(one), pixels(two)])
      if (a.width !== b.width || a.height !== b.height) return { size: [a.width, a.height, b.width, b.height] }
      let total = 0
      let most = 0
      for (let at = 0; at < a.data.length; at += 1) {
        const gap = Math.abs(a.data[at] - b.data[at])
        total += gap
        most = Math.max(most, gap)
      }
      return { width: a.width, height: a.height, mean: total / a.data.length, most }
    },
    [first, second],
  )
}

const widths = [
  [300, 300],
  [480, 360],
  [640, 480],
  [736, 560],
  [1024, 768],
  [1470, 923],
  [2940, 1600],
]

async function slideLeads(page, capture, [width, height]) {
  await page.setViewportSize({ width, height })
  const slide = page.locator("[data-view-slide]")
  const strip = page.locator("nav[data-slide-list]")
  const room = page.locator("main")
  await expect
    .poll(
      async () => {
        const [shown, space] = [await slide.boundingBox(), await room.boundingBox()]
        return Math.min(space.width - shown.width, space.height - shown.height)
      },
      { message: `at ${String(width)} px the slide fills its room` },
    )
    .toBeLessThanOrEqual(2 * (width < 640 ? 16 : 24) + 1)
  if (width < 480) {
    await expect(strip, `at ${String(width)} px the strip is hidden`).toBeHidden()
    const end = await slide.getAttribute("data-view-slide")
    await page.getByRole("button", { name: deckViewCopy.previousSlide }).click()
    await expect(slide).not.toHaveAttribute("data-view-slide", end)
    await page.getByRole("button", { name: deckViewCopy.nextSlide }).click()
    await expect(slide).toHaveAttribute("data-view-slide", end)
  } else {
    await expect(strip).toBeVisible()
    const shown = await slide.boundingBox()
    for (const thumb of await page.locator("[data-view-thumb]").all()) {
      const box = await thumb.boundingBox()
      expect(box.height, `at ${String(width)} px a thumbnail stays a thin row`).toBeLessThanOrEqual(48)
      expect(box.width, `at ${String(width)} px a thumbnail is smaller than the slide`).toBeLessThan(shown.width / 2)
    }
  }
  await capture(`deck-view-${String(width)}`)
}

export default async function drive(kit) {
  const { page, capture, note } = kit
  const opened = await openDoomDeck(kit)
  const { deck, cookie } = opened
  const call = await connectOutsideAgent(kit, cookie, "Script agent", (result) => result)
  const made = await call("execute", { deck, script: built(opened.slide) })
  expect(made.structuredContent, JSON.stringify(made.structuredContent)).toMatchObject({ ok: true })
  const slide = made.structuredContent.result
  const shot = `screenshot({ target: ${JSON.stringify(slide)} })`

  const fromEditor = await call("execute", { deck, script: shot })
  expect(fromEditor.structuredContent.screenshots).toEqual([slide])
  const editorImage = imageOf(fromEditor)
  const marked = await call("execute", {
    deck,
    script: `const t = insert({ parent: ${JSON.stringify(slide)}, kind: "text", text: "Draft", box: { x: 1500, y: 960, w: 300, h: 48 } })\n${shot}\nt`,
  })
  expect(marked.structuredContent.screenshots).toEqual([slide])
  const unmarked = await call("execute", {
    deck,
    script: `remove({ target: ${JSON.stringify(marked.structuredContent.result)} })`,
  })
  expect(unmarked.structuredContent).toMatchObject({ ok: true })
  note(
    "The editor tab answered the agent's screenshot of the built slide; the agent then marked and unmarked the slide so the server no longer holds a picture of it.",
  )

  await page.goto("about:blank")
  await page.goto(`/deck-view.html?deck=${deck}`)
  await page.locator(`[data-deck-view-ready="${deck}"]`).waitFor()
  await expect(page.locator("[data-view-thumb]")).toHaveCount(2)
  await page.locator(`[data-view-thumb="${slide}"]`).click()
  await expect(
    page.locator(`[data-view-slide="${slide}"]`).getByText("Renewals carried the quarter", { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: deckViewCopy.fullscreen })).toHaveCount(0)
  await capture("deck-view")

  const fromView = await call("execute", { deck, script: shot })
  expect(fromView.structuredContent.screenshots, JSON.stringify(fromView.structuredContent)).toEqual([slide])
  const viewImage = imageOf(fromView)
  const gap = await difference(page, editorImage, viewImage)
  note(
    `With no editor open, the deck view took the painter lease and answered the screenshot: ${String(gap.width)}x${String(gap.height)}, mean pixel difference ${gap.mean?.toFixed(3)} and largest ${String(gap.most)} of 255 against the editor's capture; the JPEG bytes are ${editorImage === viewImage ? "identical" : "different"}.`,
  )
  expect(gap.size).toBeUndefined()
  expect(gap.mean).toBeLessThan(0.5)

  for (const size of widths) await slideLeads(page, capture, size)
  note(
    `The slide is the largest thing on the page at ${widths.map(([width]) => String(width)).join(", ")} px wide; the strip is hidden under 480 px.`,
  )
  await page.setViewportSize({ width: 1470, height: 923 })

  await page.setContent(
    `<body style="margin:0;display:flex;gap:16px;padding:16px;background:#eee;font:14px sans-serif">${[
      ["Editor's capture", editorImage],
      ["Deck view's capture", viewImage],
    ]
      .map(
        ([label, data]) =>
          `<figure style="margin:0;flex:1"><img style="width:100%" src="data:image/jpeg;base64,${data}"><figcaption>${label}</figcaption></figure>`,
      )
      .join("")}</body>`,
  )
  await capture("editor-and-view-screenshots")
}
