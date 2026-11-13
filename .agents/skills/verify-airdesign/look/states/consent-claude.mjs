import { createHash, randomBytes } from "node:crypto"
import { expect } from "@playwright/test"

async function drive(kit) {
  await kit.signIn()
  const redirectUri = "https://claude.ai/api/mcp/auth_callback"
  const registered = await kit.post(kit.oauthRoutes.register, { client_name: "Claude", redirect_uris: [redirectUri] })
  const challenge = createHash("sha256").update(randomBytes(32).toString("base64url")).digest("base64url")
  const query = new URLSearchParams({
    client_id: registered.json.client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "state",
  })
  await kit.page.goto(`/oauth/authorize?${query}`)
  await expect(kit.page.getByRole("button", { name: "Allow" })).toBeVisible()
}

export default { name: "consent-claude", design: "/screens/s71-01-agents-connect-approve-claude", drive }
