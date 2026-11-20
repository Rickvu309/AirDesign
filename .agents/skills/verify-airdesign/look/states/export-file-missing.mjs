import { expect } from "@playwright/test"
import { editor } from "../editor-screen.mjs"
import { exportDialog } from "../export-dialog.mjs"

export default {
  name: "export-file-missing",
  design: editor,
  async drive(kit) {
    const { page } = kit
    await page.route("**/decks/original", (route) => route.abort("connectionfailed"))
    await exportDialog(kit)
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory()
      for await (const name of root.keys()) await root.removeEntry(name, { recursive: true })
    })
    await page.keyboard.press("Enter")
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible()
  },
}
