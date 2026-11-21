import { expect } from "@playwright/test"
import { forward, signInBrowser, test, type Stack } from "./api-stack"

type Block = { readonly type: string; readonly text?: string; readonly data?: string; readonly mimeType?: string }

const node = "256.2"
const words = "A picture shows the agent this line"

test.use({ viewport: { width: 1600, height: 1000 } })

async function readContent(stack: Stack, args: unknown, cookie: string): Promise<readonly Block[]> {
  const response = await fetch(`${stack.origin}${stack.mcp}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", cookie },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "airdesign_read_deck", arguments: args },
    }),
  })
  const data = (await response.text()).split("\n").find((line) => line.startsWith("data:"))
  const answer = JSON.parse(data?.slice("data:".length) ?? "{}") as { result?: { content?: readonly Block[] } }
  return answer.result?.content ?? []
}

test("an agent's read with picture gets the slide the open tab painted at the revision its edit made, and the deck still opens", async ({
  page,
  context,
  stack,
  decks,
}, testInfo) => {
  const { pictureWords } = await import("../../packages/mcp/src/slide-pictures.ts")
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  await expect.poll(async () => (await stack.callTool("airdesign_read_deck", { deck }, cookie)).index).toBe("ready")
  const before = await readContent(stack, { deck, slide: "256", picture: true }, cookie)
  expect(before.at(-1)?.text).toBe(pictureWords.idle)
  const read = (await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)) as {
    readonly revision: number
    readonly elements: readonly { readonly node: string; readonly version: number }[]
  }
  const version = read.elements.find((each) => each.node === node)?.version ?? 0
  const value = JSON.stringify([{ from: 0, runs: [{ from: 0, text: words }] }])
  const edited = await stack.callTool(
    "airdesign_edit_deck",
    { deck, base: read.revision, changes: [{ node, readAt: version, value }] },
    cookie,
  )
  expect(edited).toMatchObject({ ok: true })
  const revision = Number(edited.revision)
  const picture = await readContent(stack, { deck, slide: "256", picture: true }, cookie)
  const image = picture.find((block) => block.type === "image")
  expect(picture.flatMap((block) => (block.text === undefined ? [] : [block.text]))).toContain(
    pictureWords.slide(1, "256", revision),
  )
  expect(image?.mimeType).toBe("image/jpeg")
  const size = await page.evaluate(async (data) => {
    const shown = new Image()
    shown.src = `data:image/jpeg;base64,${data}`
    await shown.decode()
    return { width: shown.naturalWidth, height: shown.naturalHeight }
  }, image?.data ?? "")
  expect(size).toEqual({ width: 1280, height: 720 })
  await testInfo.attach("picture the agent received", {
    body: Buffer.from(image?.data ?? "", "base64"),
    contentType: "image/jpeg",
  })
  const painted = page.locator(`[data-slide-paint] [data-canvas-element$="#2"]`)
  await expect(painted).toContainText(words)
  await page.reload()
  await decks.ready()
  await expect(painted).toContainText(words)
})
