import { expect } from "@playwright/test"
import { openAgent } from "../agent-panel.mjs"

async function drive(kit) {
  await openAgent(kit)
  let answered = 0
  await kit.page.route("**/decks/commit", (route) => {
    answered += 1
    return route.fulfill({ status: 500, contentType: "text/html", body: "<html><body>Error</body></html>" })
  })
  const text = kit.page.locator('[contenteditable="true"]')
  await text.click()
  await text.press("End")
  await text.press("x")
  await expect.poll(() => answered).toBeGreaterThan(0)
  await kit.page.waitForTimeout(1500)
}

export default { name: "editor-error-page", design: "/screens/s49-04-editor-errors-unreached", drive }
