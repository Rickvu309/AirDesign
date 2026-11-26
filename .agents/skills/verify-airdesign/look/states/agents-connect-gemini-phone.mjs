import { createRequire } from "node:module"
import { expect } from "@playwright/test"

const load = createRequire(import.meta.url)
const { connectAgentCopy, connectChoices } = load("../../../../../apps/web/src/copy/connect-agent-copy.ts")
const [, , gemini] = connectChoices

async function drive(kit) {
  await kit.page.setViewportSize({ width: 390, height: 844 })
  await kit.signIn()
  await kit.page.goto("/settings/agents")
  await kit.page.getByRole("button", { name: connectAgentCopy.title }).click()
  const dialog = kit.page.getByRole("dialog", { name: connectAgentCopy.title })
  await dialog.getByRole("button", { name: gemini.name, exact: true }).click()
  await expect(dialog.getByRole("button", { name: gemini.ways[0].tab, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
}

export default { name: "agents-connect-gemini-phone", design: "/screens/s81-02-settings-settings-agents-tab", drive }
