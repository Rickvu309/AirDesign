import { createHash, randomBytes } from "node:crypto"
import { expect } from "@playwright/test"
import { productCopy } from "../../bin/product-copy.mjs"

const googleRelay =
  "https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-f6492779cacd5f618adb99b9-studio_airdesign_app"

async function drive(kit) {
  await kit.page.setViewportSize({ width: 390, height: 844 })
  const { cookie } = await kit.signIn()
  const registered = await kit.post(kit.oauthRoutes.register, { client_name: "Google", redirect_uris: [googleRelay] })
  const verifier = randomBytes(32).toString("base64url")
  const approved = await kit.post(
    kit.oauthRoutes.approve,
    {
      client_id: registered.json.client_id,
      redirect_uri: googleRelay,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    },
    cookie,
  )
  const exchanged = await fetch(`${kit.origin}${kit.oauthRoutes.token.path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: new URL(approved.json.redirect).searchParams.get("code") ?? "",
      code_verifier: verifier,
      client_id: registered.json.client_id,
      redirect_uri: googleRelay,
    }),
  })
  expect(exchanged.status).toBe(200)
  await kit.page.goto("/settings/agents")
  await expect(kit.page.getByRole("button", { name: productCopy.disconnect, exact: true })).toBeVisible()
}

export default { name: "agents-gemini-phone", design: "/screens/s81-02-settings-settings-agents-tab", drive }
