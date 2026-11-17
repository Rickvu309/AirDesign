import { deckRoutes } from "@airdesign/catalog"
import { afterEach, expect, it, vi } from "vitest"
import { moveFailedOf } from "@/copy/product-copy"
import { showFailed } from "./deck-notice"
import { moveDeck } from "./move-deck"

vi.mock("./deck-notice", () => ({
  settle: vi.fn(),
  showStatus: () => "pending",
  showFailed: vi.fn(),
}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it("moves the deck through the home route before navigating", async () => {
  const request = vi.fn(async () => Response.json({ ok: true }))
  vi.stubGlobal("fetch", request)
  const navigate = vi.fn()
  await moveDeck({ deck: "deck", name: "Plan" }, navigate)
  expect(request).toHaveBeenCalledWith(
    deckRoutes.trash.path,
    expect.objectContaining({ body: JSON.stringify({ deck: "deck" }) }),
  )
  expect(navigate).toHaveBeenCalledOnce()
  expect(showFailed).not.toHaveBeenCalled()
})

for (const failure of ["refused", "network"]) {
  it(`stays in the editor and offers retry after a ${failure} failure`, async () => {
    vi.stubGlobal(
      "fetch",
      failure === "network"
        ? vi.fn().mockRejectedValue(new Error("offline"))
        : vi.fn(async () => Response.json({ ok: false })),
    )
    const navigate = vi.fn()
    await moveDeck({ deck: "deck", name: "Plan" }, navigate)
    expect(navigate).not.toHaveBeenCalled()
    expect(showFailed).toHaveBeenCalledWith("move-deck", moveFailedOf("Plan"), expect.any(Function), "pending")
  })
}
