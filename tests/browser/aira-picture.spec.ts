import { join } from "node:path"
import { expect } from "@playwright/test"
import { airaCopy } from "../../apps/web/src/copy/aira-copy.ts"
import { forward, signInBrowser, test } from "./api-stack"

type Block = { readonly type: string; readonly text?: string; readonly source?: { readonly data: string } }
type Turn = { readonly messages: readonly { readonly content: unknown }[] }

test("Aira sees the picture of the slide it changed, from the same read an outside agent gets, once", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const { pictureWords } = await import("../../packages/mcp/src/slide-pictures.ts")
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const turns: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/aira/turn") turns.push(request.postData() ?? "")
  })
  const deck = await decks.open(join(process.cwd(), "scripts/pptx-fixtures/blank.pptx"))
  const base = Number((await stack.post("/decks/open", { deck }, cookie)).json.revision)
  stack.aira(
    { name: "add-text-box.sse", fill: { deck, base: String(base) } },
    { name: "look.sse", fill: { deck } },
    { name: "looked.sse" },
  )
  await page.getByRole("textbox", { name: airaCopy.askAira }).fill("Add a text box, then look at the slide")
  await page.keyboard.press("Enter")
  await expect(page.getByText("The slide shows the new text box.")).toBeVisible({ timeout: 30_000 })
  expect(turns).toHaveLength(3)
  const looked = JSON.parse(turns[2] ?? "{}") as Turn
  const answer = (looked.messages.at(-1)?.content as { content: readonly Block[] }[])[0]?.content ?? []
  const { revision } = JSON.parse(answer[1]?.text ?? "{}") as { readonly revision: number }
  expect(revision).toBeGreaterThan(base)
  expect(answer.flatMap((block) => (block.type === "text" ? [block.text] : []))).toContain(
    pictureWords.slide(1, "256", revision),
  )
  const images = answer.filter((block) => block.type === "image")
  expect(images).toHaveLength(1)
  const size = await page.evaluate(async (data) => {
    const shown = new Image()
    shown.src = `data:image/jpeg;base64,${data}`
    await shown.decode()
    return { width: shown.naturalWidth, height: shown.naturalHeight }
  }, images[0]?.source?.data ?? "")
  expect(size).toEqual({ width: 1280, height: 720 })
  const texts = page.locator('[data-slide-paint] [contenteditable="true"]')
  await expect(texts.last()).toHaveText("Hello from Aira")
  await page.reload()
  await decks.ready()
  await expect(texts.last()).toHaveText("Hello from Aira")
})
