import { editor } from "../editor-screen.mjs"
import { committing, importedDeck, reopened } from "../lost-answer.mjs"

async function drive(kit) {
  const { page } = kit
  const commits = committing(kit)
  await importedDeck(kit)
  let landed = () => undefined
  const reached = new Promise((resolve) => {
    landed = resolve
  })
  await page.route(commits, async (route) => {
    await route.fetch()
    landed()
    await route.abort().catch(() => undefined)
  })
  await page.getByRole("button", { name: "Add slide" }).first().click()
  await reached
  await page.unroute(commits)
  await reopened(page)
  await reopened(page)
}

export default { name: "lost-answer-reloaded", design: editor, drive }
