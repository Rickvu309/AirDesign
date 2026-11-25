import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fontRoutes } from "../../packages/fonts/src/index.ts"
import { slideListCopy } from "../../apps/web/src/copy/slide-list-copy"
import { expect, type Page } from "@playwright/test"
import { test, type Stack } from "./api-stack"
import { accent, landNodes, openEditor, savedSlides, serveOriginals, spot, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const pictureFile = join(process.cwd(), "tests/browser/fixtures/picture.png")

const words = (text: string) => ({
  chars: text,
  spans: [],
  paras: [{}],
  style: "title",
  resize: "height",
  alignV: "top",
})

async function dropPicture(page: Page) {
  const bytes = [...(await readFile(pictureFile))]
  await page.evaluate(
    ([bytes]) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([new Uint8Array(bytes!)], "picture.png", { type: "image/png" }))
      document
        .querySelector("[data-editor-stage]")!
        .dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }))
    },
    [bytes] as const,
  )
}

const jpeg = (data: string | undefined) => {
  const bytes = Buffer.from(data ?? "", "base64")
  return bytes[0] === 0xff && bytes[1] === 0xd8
}

async function read(stack: Stack, opened: Opened, more: Record<string, unknown> = {}) {
  const blocks = await stack.toolBlocks(
    "airdesign_read_deck",
    { deck: opened.deck, picture: true, ...more },
    opened.cookie,
  )
  const json = blocks.find((block) => block.type === "text")?.text ?? "{}"
  return {
    images: blocks.filter((block) => block.type === "image"),
    answer: JSON.parse(json) as { readonly note?: string; readonly pictures?: readonly string[] },
  }
}

async function landTitle(stack: Stack, opened: Opened, id: string, text: string) {
  await landNodes(stack, opened, [
    {
      id,
      type: "shape",
      parent: opened.slide,
      props: { box: spot(160, 120, 1600, 200), text: words(text), fills: accent, geometry: { kind: "rect" } },
    },
  ])
}

test("an agent reading a Doom deck with picture gets the slide as the open tab painted it, and never an old one as the new one", async ({
  page,
  context,
  stack,
}) => {
  await serveOriginals(page, stack.originals)
  const opened = await openEditor(page, context, stack)
  await landTitle(stack, opened, "w:1", "Revenue grew")
  await expect(page.locator("[data-slide-box]").getByText("Revenue grew")).toBeVisible()
  await dropPicture(page)
  await expect(page.locator('[data-slide-box] [data-paint="image"]')).toHaveCount(1)
  await expect(
    page.locator('[data-slide-entry="1"] [data-paint="image"]'),
    "the filmstrip shows the picture too",
  ).toHaveCount(1)

  let first = await read(stack, opened, { slide: opened.slide })
  await expect
    .poll(async () => {
      first = await read(stack, opened, { slide: opened.slide })
      return first.images.length
    })
    .toBe(1)
  expect(jpeg(first.images[0]?.data)).toBe(true)
  expect(first.answer.pictures).toEqual([opened.slide])
  await test.info().attach("slide-picture.jpg", {
    body: Buffer.from(first.images[0]?.data ?? "", "base64"),
    contentType: "image/jpeg",
  })

  let blocked = true
  await page.route("**/doom/pictures", async (route) => {
    if (blocked) await route.abort()
    else await route.fallback()
  })
  await landTitle(stack, opened, "w:2", "Costs fell")
  await expect(page.locator("[data-slide-box]").getByText("Costs fell")).toBeVisible()
  const behind = await read(stack, opened, { slide: opened.slide })
  expect(behind.images).toHaveLength(0)
  expect(behind.answer.note).toContain(`No current picture of slide ${opened.slide}`)

  blocked = false
  await expect
    .poll(async () => (await read(stack, opened, { slide: opened.slide })).images.length, { timeout: 20_000 })
    .toBe(1)
})

test("a picture whose bytes this device does not hold says it is still uploading, in its box", async ({
  page,
  context,
  stack,
}) => {
  await serveOriginals(page, stack.originals)
  const opened = await openEditor(page, context, stack)
  await landNodes(stack, opened, [
    {
      id: "w:3",
      type: "shape",
      parent: opened.slide,
      props: {
        box: spot(160, 200, 800, 450),
        geometry: { kind: "rect" },
        fills: [{ kind: "image", asset: "e".repeat(64), fit: "fill" }],
      },
    },
  ])
  const { pictureCopy } = await import("../../apps/web/src/copy/picture-copy.ts")
  const label = page.locator("[data-slide-box] [data-unshown-label]")
  await expect(label).toHaveText(pictureCopy.uploading)
})

test("the first agent picture includes text in a freshly loaded font", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  const chars = "lợi nhuận quý".normalize("NFD")
  await landNodes(stack, opened, [
    {
      id: "w:4",
      parent: opened.slide,
      type: "shape",
      props: {
        box: spot(190, 140, 460, 100),
        text: { ...words(chars), spans: [{ end: chars.length, font: "Liberation Sans Narrow", size: 44 }] },
      },
    },
  ])
  const layer = page.locator('[data-slide-box] [data-node="w:4"]')
  await expect(layer).toBeVisible()
  await expect(layer).toHaveText(chars)
  let image: string | undefined
  await expect
    .poll(async () => {
      const picture = await read(stack, opened, { slide: opened.slide })
      image = picture.images[0]?.data
      return image?.length ?? 0
    })
    .toBeGreaterThan(0)
  const ink = await page.evaluate(async (data) => {
    const picture = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${data}`)).blob())
    const reader = new OffscreenCanvas(picture.width, picture.height).getContext("2d")
    if (reader === null) throw new Error("Unable to inspect the slide picture")
    reader.drawImage(picture, 0, 0)
    const pixels = reader.getImageData(126, 93, 308, 67).data
    return pixels.filter((ink, position) => position % 4 === 0 && ink < 100).length
  }, image)
  expect(ink).toBeGreaterThan(100)
})

test("a font failure is reported only for the requested slide using that font", async ({ page, context, stack }) => {
  const opened = await openEditor(page, context, stack)
  await page.getByRole("button", { name: slideListCopy.addSlide }).click()
  await expect.poll(async () => (await savedSlides(stack, opened)).length).toBe(2)
  const [, other] = await savedSlides(stack, opened)
  if (other === undefined) throw new Error("Missing second slide")
  await page.route(
    (url) => url.pathname === fontRoutes.family.path && url.searchParams.get("family") === "Montserrat",
    (route) => route.fulfill({ status: 503 }),
  )
  await page.locator('[data-slide-entry="1"]').click()
  await landNodes(stack, opened, [
    {
      id: "w:5",
      parent: opened.slide,
      type: "shape",
      props: {
        box: spot(160, 120, 1200, 120),
        text: { ...words("Healthy slide"), spans: [{ end: 13, font: "Lora" }] },
      },
    },
    {
      id: "w:6",
      parent: other,
      type: "shape",
      props: {
        box: spot(160, 120, 1200, 120),
        text: { ...words("Missing font"), spans: [{ end: 12, font: "Montserrat" }] },
      },
    },
  ])
  await expect(page.locator('[data-slide-entry="2"] [data-node="w:6"] [data-font-pending]')).toBeVisible()

  const failed = await read(stack, opened, { slide: other })
  expect(failed.images).toHaveLength(0)
  expect(failed.answer.note).toContain(`A font couldn’t load for slide ${other}.`)
  const captured = await read(stack, opened, { slide: opened.slide })
  expect(captured.answer.pictures).toEqual([opened.slide])
  expect(jpeg(captured.images[0]?.data)).toBe(true)
})
