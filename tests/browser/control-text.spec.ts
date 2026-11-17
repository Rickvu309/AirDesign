import { pathToFileURL } from "node:url"
import { textCopy } from "../../apps/web/src/copy/text-copy"
import { undoCopy } from "../../apps/web/src/copy/undo-copy"
import { join } from "node:path"

import { partsOf } from "./shape-fills"
import { savedExport } from "./export-dialog"
import { expect, test } from "@playwright/test"
import { designing, fixtures, openDeck, pendingValues, settled } from "./design-panel"

const loadFixture = () =>
  import(pathToFileURL(join(fixtures, "text-runs.mjs")).href) as Promise<
    typeof import("../../scripts/pptx-fixtures/text-runs.mjs")
  >

test.use({ viewport: { width: 1600, height: 1000 } })

test("a text field rewrites the element's words in their own size and colour, and Undo brings the words back", async ({
  page,
}) => {
  await openDeck(page, "clean.pptx")
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  const panel = await designing(page, editor)
  const words = panel.getByRole("textbox", { name: textCopy.value, exact: true })
  await expect(words).toHaveValue("Hello")
  await words.fill("Hello there\nSecond line")
  await words.blur()
  await expect(editor).toHaveText("Hello thereSecond line")
  await expect(editor.locator("[data-paragraph]")).toHaveCount(2)
  const sizes = () =>
    editor.locator("[data-run]").evaluateAll((runs) => runs.map((run) => getComputedStyle(run).fontSize))
  const [size] = await sizes()
  await expect.poll(sizes).toEqual([size, size])
  await expect.poll(async () => (await pendingValues(page, "256.2")).length).toBe(1)
  await page.getByRole("button", { name: undoCopy.undoNamed.text, exact: true }).click()
  await expect(editor).toHaveText("Hello")
  await expect(words).toHaveValue("Hello")
  await words.fill("Kept")
  await words.press("ControlOrMeta+Enter")
  await expect(editor).toHaveText("Kept")
  await page.reload()
  await settled(page)
  await expect(page.locator('[data-slide-paint] [contenteditable="true"]')).toHaveText("Kept")
})

test("a Text correction keeps every mixed run through Undo, reload and export", async ({ page }, testInfo) => {
  const { textRunsDeck, textRunsParts, textRunsParagraphs } = await loadFixture()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles({
    name: "text-runs.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: textRunsDeck(await partsOf(join(fixtures, "clean.pptx"))),
  })
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await settled(page)
  const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
  const panel = await designing(page, editor)
  const words = panel.getByRole("textbox", { name: textCopy.value, exact: true })
  const styles = () =>
    editor.locator("[data-run]").evaluateAll((runs) =>
      runs.map((run) => {
        const style = getComputedStyle(run)
        return {
          bold: style.fontWeight,
          color: style.color,
          font: style.fontFamily,
          size: style.fontSize,
          italic: style.fontStyle,
        }
      }),
    )
  const before = await styles()
  expect(before).toHaveLength(4)
  await words.focus()
  await words.evaluate((field) => field.setSelectionRange(11, 11))
  await words.press("!")
  await words.press("ControlOrMeta+Enter")
  await expect(editor).toHaveText("Revenue 39%!Costs fell")
  await expect.poll(styles).toEqual(before)
  await page.getByRole("button", { name: undoCopy.undoNamed.text, exact: true }).click()
  await expect(words).toHaveValue("Revenue 39%\nCosts fell")
  await expect.poll(styles).toEqual(before)
  await words.focus()
  await words.evaluate((field) => field.setSelectionRange(11, 11))
  await words.press("!")
  await words.blur()
  await expect(editor).toHaveText("Revenue 39%!Costs fell")
  await expect.poll(async () => String((await pendingValues(page, "256.2")).at(-1))).toContain("39%!")
  await page.reload()
  await settled(page)
  await expect(editor).toHaveText("Revenue 39%!Costs fell")
  await expect.poll(styles).toEqual(before)
  const file = testInfo.outputPath("text-runs.pptx")
  await savedExport(page, file)
  const saved = await partsOf(file)
  const original = textRunsParts(await partsOf(join(fixtures, "clean.pptx")))
  expect([...saved.keys()]).toEqual([...original.keys()])
  for (const [name, bytes] of original) {
    if (name === "ppt/slides/slide1.xml") continue
    expect(saved.get(name), name).toEqual(bytes)
  }
  const xml = saved.get("ppt/slides/slide1.xml")?.toString("utf8") ?? ""
  expect(xml).toContain(textRunsParagraphs[0].replace("39%", "39%!"))
  expect(xml).toContain(textRunsParagraphs[1])
})

for (const correction of ["delete", "Backspace", "replace", "native undo", "composition"]) {
  test(`repeated characters keep the actual survivor after ${correction}, Undo, reload and export`, async ({
    page,
  }, testInfo) => {
    const { repeatedTextDeck, repeatedTextParts, textRunsParagraphs } = await loadFixture()
    const original = repeatedTextParts(await partsOf(join(fixtures, "clean.pptx")))
    await page.goto("/")
    await page.locator("input[type=file]").setInputFiles({
      name: "repeated.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      buffer: repeatedTextDeck(await partsOf(join(fixtures, "clean.pptx"))),
    })
    await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
    await settled(page)
    const editor = page.locator('[data-slide-paint] [contenteditable="true"]')
    const panel = await designing(page, editor)
    const words = panel.getByRole("textbox", { name: textCopy.value, exact: true })
    const runs = editor.locator("[data-run]")
    const styles = () =>
      runs.evaluateAll((items) =>
        items.map((item) => ({
          text: item.textContent,
          bold: getComputedStyle(item).fontWeight,
          color: getComputedStyle(item).color,
        })),
      )
    const before = await styles()
    async function correct() {
      await words.focus()
      await words.evaluate(
        (field, operation) =>
          field.setSelectionRange(
            operation === "Backspace" ? 1 : 0,
            operation === "replace" || operation === "composition" || operation === "Backspace" ? 1 : 0,
          ),
        correction,
      )
      if (correction === "composition") {
        const client = await page.context().newCDPSession(page)
        await client.send("Input.imeSetComposition", { text: "x", selectionStart: 1, selectionEnd: 1 })
        await client.send("Input.imeSetComposition", { text: "2", selectionStart: 1, selectionEnd: 1 })
        await client.send("Input.insertText", { text: "2" })
        await client.detach()
      } else {
        if (correction === "replace") await words.press("2")
        else if (correction === "Backspace") await words.press("Backspace")
        else await words.press("Delete")
      }
      if (correction === "native undo") {
        await words.press("ControlOrMeta+z")
        await expect(words).toHaveValue("11\nCosts fell")
        await words.press("ControlOrMeta+Shift+z")
      }
      await words.press("ControlOrMeta+Enter")
    }
    await correct()
    const expected =
      correction === "replace" || correction === "composition"
        ? [{ ...before[0], text: "2" }, ...before.slice(1)]
        : before.slice(1)
    await expect.poll(styles).toEqual(expected)
    await page.getByRole("button", { name: undoCopy.undoNamed.text, exact: true }).click()
    await expect.poll(styles).toEqual(before)
    await correct()
    await expect.poll(styles).toEqual(expected)
    await expect.poll(async () => String((await pendingValues(page, "256.2")).at(-1))).toContain('"from":1')
    await page.reload()
    await settled(page)
    await expect.poll(styles).toEqual(expected)
    const file = testInfo.outputPath("repeated.pptx")
    await savedExport(page, file)
    const saved = await partsOf(file)
    expect([...saved.keys()]).toEqual([...original.keys()])
    for (const [name, bytes] of original)
      if (name !== "ppt/slides/slide1.xml") expect(saved.get(name), name).toEqual(bytes)
    const xml = saved.get("ppt/slides/slide1.xml")?.toString("utf8") ?? ""
    const paragraph = textRunsParagraphs[0]!.replace("Revenue ", "1").replace("39%", "1")
    const changed =
      correction === "replace" || correction === "composition"
        ? paragraph.replace("<a:t>1</a:t>", "<a:t>2</a:t>")
        : paragraph.replace(/<a:r><a:rPr lang="en-US" sz="3200"\/><a:t>1<\/a:t><\/a:r>/, "")
    expect(xml).toContain(changed)
    expect(xml).toContain(textRunsParagraphs[1])
  })
}
