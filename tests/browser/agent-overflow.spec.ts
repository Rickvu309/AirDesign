import { expect } from "@playwright/test"
import { forward, signInBrowser, test } from "./api-stack"

type Overflow = { readonly needed: number; readonly room: number; readonly fix: { readonly size: number | null } }

type Read = {
  readonly revision: number
  readonly findings: string
  readonly elements: readonly { readonly node: string; readonly version: number; readonly overflow?: Overflow }[]
}

const node = "256.2"
const longer =
  "An agent poured a whole paragraph into this box, far more words than a thirty-two point line can hold inside its frame, so the text runs past the bottom edge"

test.use({ viewport: { width: 1600, height: 1000 } })

test("an agent's read names the text the open tab measured past its box and the size that fits, and the size clears it", async ({
  page,
  context,
  stack,
  decks,
}) => {
  const cookie = await stack.signIn()
  await signInBrowser(context, cookie)
  await forward(page, stack)
  const deck = await decks.open()
  await expect.poll(async () => (await stack.callTool("airdesign_read_deck", { deck }, cookie)).index).toBe("ready")
  const read = async () =>
    (await stack.callTool("airdesign_read_deck", { deck, slide: "256" }, cookie)) as unknown as Read
  await expect.poll(async () => (await read()).findings).toBe("ready")
  const fits = await read()
  const shown = fits.elements.find((each) => each.node === node)
  expect(shown).not.toHaveProperty("overflow")
  const typed = await stack.callTool(
    "airdesign_edit_deck",
    {
      deck,
      base: fits.revision,
      changes: [
        { node, readAt: shown?.version ?? 0, value: JSON.stringify([{ from: 0, runs: [{ from: 0, text: longer }] }]) },
      ],
    },
    cookie,
  )
  expect(typed).toMatchObject({ ok: true })
  const over = await read()
  expect(over.findings).toBe("ready")
  const overflow = over.elements.find((each) => each.node === node)?.overflow
  expect(overflow?.room).toBeCloseTo(136.8, 0)
  expect(overflow?.needed ?? 0).toBeGreaterThan(overflow?.room ?? 0)
  const size = overflow?.fix.size ?? 0
  expect(size).toBeGreaterThan(8)
  expect(size).toBeLessThan(32)
  const sized = await stack.callTool(
    "airdesign_edit_deck",
    { deck, base: over.revision, changes: [{ op: "set", target: node, text: { size } }] },
    cookie,
  )
  expect(sized).toMatchObject({ ok: true })
  const cleared = await read()
  expect(cleared.findings).toBe("ready")
  expect(cleared.elements.find((each) => each.node === node)).not.toHaveProperty("overflow")
  const painted = await page.locator(`[data-slide-paint] [data-canvas-element$="#2"]`).evaluate((frame) => {
    const body = frame.querySelector<HTMLElement>("[data-text-body]")
    return body === null
      ? null
      : { body: body.getBoundingClientRect().height, box: frame.getBoundingClientRect().height }
  })
  expect(painted).not.toBeNull()
  expect(painted?.body ?? 0).toBeLessThanOrEqual((painted?.box ?? 0) + 1)
})
