import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { expect } from "@playwright/test"
import { groupCopy, undoCopy } from "../../bin/product-copy.mjs"

const part = "ppt/slides/slide1.xml"
const line = '<a:p><a:r><a:rPr lang="en-US" sz="1800"/><a:t>A card line</a:t></a:r></a:p>'
const card = (id, y) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Card ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1828800" y="${y}"/><a:ext cx="3657600" cy="369332"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="DDEEFF"/></a:solidFill></p:spPr><p:txBody><a:bodyPr wrap="square"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${line}</p:txBody></p:sp>`

async function cards(repo) {
  const zip = createRequire(path.join(repo, "packages/pptx/package.json"))("@zip.js/zip.js")
  const reader = new zip.ZipReader(
    new zip.Uint8ArrayReader(new Uint8Array(await readFile(path.join(repo, "scripts/pptx-fixtures/blank.pptx")))),
  )
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter())
  for (const entry of await reader.getEntries()) {
    if (entry.directory) continue
    let bytes = await entry.getData(new zip.Uint8ArrayWriter())
    if (entry.filename === part)
      bytes = new TextEncoder().encode(
        Buffer.from(bytes)
          .toString("utf8")
          .replace("</p:spTree>", `${card(20, 2743200)}${card(21, 3657600)}</p:spTree>`),
      )
    await writer.add(entry.filename, new zip.Uint8ArrayReader(bytes))
  }
  await reader.close()
  return Buffer.from(await writer.close())
}

async function drive(kit) {
  const { page } = kit
  await kit.signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "cards.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await cards(kit.repo),
  })
  await expect(page).toHaveURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  const deck = page.url().split("/").at(-1)
  await expect(page.locator(".thin-page")).toHaveAttribute("data-deck-ready", deck)
  const shape = (id) => page.locator(`[data-slide-paint] [data-canvas-element="${part}#${id}"]`)
  await shape(20).click()
  await shape(21).click({ modifiers: ["Shift"] })
  await page.keyboard.press("Shift+A")
  await expect(page.locator("[data-slide-paint]").getByRole("status")).toHaveText(groupCopy.said.frame)
  const before = await shape(21).boundingBox()
  await shape(20).dblclick()
  await page.keyboard.press("Enter")
  await page.keyboard.press("End")
  for (const _ of [1, 2, 3]) {
    await page.keyboard.press("Enter")
    await page.keyboard.type("Another line")
  }
  await expect.poll(async () => (await shape(21).boundingBox()).y - before.y).toBeGreaterThan(40)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: undoCopy.undoNamed.text, exact: true }).click()
  await expect(shape(20)).toContainText("A card line")
  await expect(shape(20)).not.toContainText("Another line")
  await page.waitForTimeout(1500)
  await page.mouse.move(4, 4)
}

export default { name: "frame-text-undone", design: null, drive }
