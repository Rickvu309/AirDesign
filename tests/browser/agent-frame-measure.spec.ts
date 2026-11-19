import { expect } from "@playwright/test"
import { forward, openClean, signInBrowser, test, type Stack } from "./api-stack"

type Read = {
  readonly revision: number
  readonly elements: readonly {
    readonly node: string
    readonly version: number
    readonly box: { readonly y: number; readonly cy: number }
  }[]
}

const longer =
  "A card line that an agent wrote much longer, so that it wraps onto several lines inside the card and pushes the next card down"

test.use({ viewport: { width: 1600, height: 1000 } })

async function edited(stack: Stack, cookie: string, deck: string, base: number, change: object) {
  const answer = await stack.callTool("airdesign_edit_deck", { deck, base, changes: [change] }, cookie)
  expect(answer).toMatchObject({ ok: true })
  return answer as { readonly revision: number; readonly elements?: readonly { readonly node: string }[] }
}

test("an agent's read after it lengthens a frame's text on a slide the person is not viewing shows the height the open tab measured", async ({
  page,
  context,
  stack,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await openClean(page)
  await expect.poll(async () => (await stack.callTool("airdesign_read_deck", { deck }, cookie)).index).toBe("ready")
  let base = (await stack.post("/decks/open", { deck }, cookie)).json.revision as number
  const added = await edited(stack, cookie, deck, base, { op: "add_slide", after: "256", layout: "256" })
  const slide = (await stack.callTool("airdesign_read_deck", { deck }, cookie)) as unknown as {
    readonly slides: readonly { readonly id: string }[]
  }
  const fresh = slide.slides.map((each) => each.id).find((id) => id !== "256")
  if (fresh === undefined) throw new Error("no new slide")
  base = added.revision
  const cards: string[] = []
  for (const y of [100, 160]) {
    const card = await edited(stack, cookie, deck, base, {
      op: "add",
      kind: "shape",
      slide: fresh,
      box: { x: 100, y, w: 300, h: 30 },
      text: { value: "A card line" },
    })
    base = card.revision
    cards.push(card.elements?.[0]?.node ?? "")
  }
  const [top = "", next = ""] = cards
  for (const node of cards)
    base = (await edited(stack, cookie, deck, base, { op: "set", target: node, body: { autofit: "grow" } })).revision
  base = (await edited(stack, cookie, deck, base, { op: "frame", elements: cards })).revision
  await expect(page.locator("[data-slide-entry]")).toHaveCount(2)
  const read = async () => {
    const answer = (await stack.callTool("airdesign_read_deck", { deck, slide: fresh }, cookie)) as unknown as Read
    const found = (node: string) => answer.elements.find((each) => each.node === node)
    return {
      revision: answer.revision,
      version: found(top)?.version ?? 0,
      top: found(top)?.box,
      next: found(next)?.box,
    }
  }
  const before = await read()
  await edited(stack, cookie, deck, before.revision, {
    node: top,
    readAt: before.version,
    value: JSON.stringify([{ from: 0, runs: [{ from: -1, text: longer }] }]),
  })
  const after = await read()
  const grew = (after.top?.cy ?? 0) - (before.top?.cy ?? 0)
  expect(grew).toBeGreaterThan(100_000)
  expect((after.next?.y ?? 0) - (before.next?.y ?? 0)).toBe(grew)
  await expect(page.locator("[data-measure-paint]")).toHaveCount(0)
})
