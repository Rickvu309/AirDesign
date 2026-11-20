import { transitionCopy } from "../../bin/product-copy.mjs"
import { editor } from "../editor-screen.mjs"
import { namedSlides, selectTwoToFour } from "../slide-list-set.mjs"

async function drive({ page, signIn }) {
  await signIn()
  await page.goto("/")
  await namedSlides(page, 5)
  await page.getByRole("button", { name: transitionCopy.design, exact: true }).click()
  await selectTwoToFour(page)
}

export default { name: "slide-list-set", design: editor, drive }
