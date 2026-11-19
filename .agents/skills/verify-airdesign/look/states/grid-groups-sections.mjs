import { manySlides } from "../../../../../tests/browser/slide-grid-deck.ts"
import { openDeck } from "../open-deck.mjs"
async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/")
  await openDeck(kit.page, {
    name: "sections.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: await manySlides(6, true),
  })
  await kit.page.getByRole("button", { name: "Grid", exact: true }).click()
}
export default { name: "grid-groups-sections", design: "/screens/s41-01-editor-grid-default", drive }
