import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await kit.page.locator("input[type=file]").setInputFiles({
    name: "refused.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: Buffer.from("not a PowerPoint"),
  })
  await expect(kit.page.getByRole("alert")).toBeVisible()
}

export default { name: "import-refused", design: "/screens/s32-03-decks-new-deck-import-failed", drive }
