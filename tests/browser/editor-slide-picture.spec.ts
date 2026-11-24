import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Page } from "@playwright/test"
import { test, type Stack } from "./api-stack"
import { accent, landNodes, openDoomEditor, serveOriginals, spot, type Opened } from "./editor-deck"

test.use({ viewport: { width: 1600, height: 1000 } })

const pictureFile = join(process.cwd(), "scripts/pptx-fixtures/picture.png")

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
        .querySelector("[data-doom-stage]")!
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
  const opened = await openDoomEditor(page, context, stack)
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
  const opened = await openDoomEditor(page, context, stack)
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
