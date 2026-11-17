import { describe, expect, it } from "vitest"
import { loadCredits, changeCredits } from "./credits-load"

const credits = { cents: 1500, autoReset: false, history: [] }
const response =
  (body: unknown, status = 200): typeof fetch =>
  async () =>
    Response.json(body, { status })

describe("credits requests", () => {
  it("loads stored credits and rejects malformed amounts", async () => {
    expect(await loadCredits(response({ ok: true, credits }))).toEqual({ kind: "credits", credits })
    expect(await loadCredits(response({ ok: true, credits: { ...credits, cents: -1 } }))).toEqual({
      kind: "unavailable",
    })
  })
  it("distinguishes an expired session from an unavailable server", async () => {
    expect(await loadCredits(response({ ok: false, refusal: "session" }, 401))).toEqual({ kind: "signed-out" })
    expect(await loadCredits(response({}, 500))).toEqual({ kind: "unavailable" })
  })
  it("keeps a reset's request id when retrying a lost answer", async () => {
    const sent: unknown[] = []
    const send: typeof fetch = async (_url, init) => {
      sent.push(JSON.parse(String(init?.body)))
      return Response.json({ ok: true, credits })
    }
    await changeCredits({ kind: "reset", once: "same-reset" }, send)
    await changeCredits({ kind: "reset", once: "same-reset" }, send)
    expect(sent).toEqual([{ once: "same-reset" }, { once: "same-reset" }])
  })
  it("reports a refused reset without pretending it succeeded", async () => {
    expect(
      await changeCredits({ kind: "reset", once: "reset" }, response({ ok: false, refusal: "credits" }, 409)),
    ).toEqual({ kind: "refused", refusal: "credits" })
  })
})
