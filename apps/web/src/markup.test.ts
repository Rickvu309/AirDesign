import { expect, it } from "vitest"
import { ensureMarkup } from "./markup"

it("resolves markup before an export without loading a parser", async () => {
  await expect(ensureMarkup()).resolves.toBeUndefined()
})
