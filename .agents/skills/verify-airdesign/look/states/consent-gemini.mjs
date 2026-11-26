import { createHash, randomBytes } from "node:crypto"
import { expect } from "@playwright/test"

const googleRelay =
  "https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-f6492779cacd5f618adb99b9-studio_airdesign_app"

async function drive(kit) {
  await kit.signIn()
  const registered = await kit.post(kit.oauthRoutes.register, { client_name: "Google", redirect_uris: [googleRelay] })
  const challenge = createHash("sha256").update(randomBytes(32).toString("base64url")).digest("base64url")
  const query = new URLSearchParams({
    client_id: registered.json.client_id,
    redirect_uri: googleRelay,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "s".repeat(2400),
  })
  await kit.page.goto(`/oauth/authorize?${query}`)
  await expect(kit.page.getByRole("button", { name: "Allow" })).toBeVisible()
}

export default { name: "consent-gemini", design: "/screens/s71-01-agents-connect-approve-claude", drive }
