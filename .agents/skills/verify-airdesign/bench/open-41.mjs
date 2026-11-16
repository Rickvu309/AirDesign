import path from "node:path"
import { home, imported, painted } from "./import.mjs"

export default {
  name: "open-41",
  async setup({ repo, page, signIn }) {
    await signIn()
    await home(page)
    return imported(page, path.join(repo, "scripts/pptx-fixtures/doe-heat-pumps.pptx"))
  },
  async measure({ page }, deck) {
    const started = Date.now()
    await page.goto(`/deck/${deck}`)
    await painted(page, deck)
    return Date.now() - started
  },
}
