import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { groupCopy } from "../../../../apps/web/src/copy/arrange-copy.ts"

const part = "ppt/slides/slide1.xml"
const line = '<a:p><a:r><a:rPr lang="en-US" sz="1800"/><a:t>A card line</a:t></a:r></a:p>'
const card = (id, y) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Card ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="1828800" y="${y}"/><a:ext cx="3657600" cy="369332"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="DDEEFF"/></a:solidFill></p:spPr><p:txBody><a:bodyPr wrap="square"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${line}</p:txBody></p:sp>`

export default async function drive({ page, signIn, post, capture, note, deckRoutes, repo, expect }) {
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
  const buffer = Buffer.from(await writer.close())
  const { cookie } = await signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "cards.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer,
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
  await capture("column-wrapped")
  await shape(20).click()
  await shape(20).click()
  await page.keyboard.press("Enter")
  await page.keyboard.press("End")
  for (const _ of [1, 2, 3]) {
    await page.keyboard.press("Enter")
    await page.keyboard.type("Another line")
  }
  await expect.poll(async () => (await shape(21).boundingBox()).y - before.y).toBeGreaterThan(40)
  await page.keyboard.press("Escape")
  await capture("text-grew")
  const saved = (await post(deckRoutes.open, { deck }, cookie)).json
  const top = Object.keys(saved.register.elements).find((key) => key.endsWith(".20"))
  const rows = top === undefined ? [] : (saved.register.elements[top]?.landed ?? [])
  const heights = rows.flatMap((row) => (row.patch?.box?.h?.set === undefined ? [] : [row.patch.box.h.set]))
  expect(heights.length).toBeGreaterThan(0)
  note(
    `Two growing text boxes wrapped into an auto layout column with Shift+A; typing three more lines into the top one grew it and pushed the bottom one down by ${Math.round((await shape(21).boundingBox()).y - before.y)} px, and the server holds the measured height as a box.h row on the top box (${heights.at(-1)} EMU).`,
  )
}
