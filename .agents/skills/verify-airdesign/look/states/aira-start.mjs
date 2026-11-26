import { productCopy } from "../../bin/product-copy.mjs"
import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  await kit.page.goto("/aira")
  await expect(kit.page.getByRole("heading", { name: productCopy.storyHeadline })).toBeVisible()
}

export default { name: "aira-start", design: "/screens/s35-01-decks-aira-start", drive }
