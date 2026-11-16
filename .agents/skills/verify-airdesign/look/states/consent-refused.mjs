import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  const query = new URLSearchParams({ client_id: "unknown", redirect_uri: "https://claude.ai/api/mcp/auth_callback" })
  await kit.page.goto(`/oauth/authorize?${query}`)
  await expect(kit.page.getByRole("link", { name: "Back to AirDesign" })).toBeVisible()
}

export default { name: "consent-refused", design: "/screens/s71-05-agents-connect-refused", drive }
