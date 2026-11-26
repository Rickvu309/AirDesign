import { createHash, randomBytes } from "node:crypto"
import * as doom from "../../packages/doom/src/index.ts"
import type { Stack } from "./api-stack"
import type { Opened } from "./editor-deck"
import { settingsCopy } from "../../apps/web/src/copy/settings-copy.ts"

export async function saved(stack: Stack, opened: Opened) {
  const { doomRoutes } = await import("../../packages/catalog/src/index.ts")
  const answer = await stack.post(doomRoutes.open.path, { deck: opened.deck }, opened.cookie)
  const fold = doom.readFold(answer.json.fold)
  if (fold === undefined) throw new Error("no fold")
  return fold
}

export async function connectClaudeCode(stack: Stack, cookie: string): Promise<string> {
  const { oauthRoutes } = await import("../../packages/catalog/src/index.ts")
  const redirect = "http://127.0.0.1:33418/callback"
  const registered = await stack.post(oauthRoutes.register.path, {
    redirect_uris: [redirect],
    client_name: settingsCopy.claudeCode,
  })
  const client = (registered.json as { client_id: string }).client_id
  const verifier = randomBytes(32).toString("base64url")
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  const approved = await stack.post(
    oauthRoutes.approve.path,
    { client_id: client, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: "S256" },
    cookie,
  )
  const code = new URL((approved.json as { redirect: string }).redirect).searchParams.get("code") ?? ""
  const token = await fetch(`${stack.origin}${oauthRoutes.token.path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: client,
      redirect_uri: redirect,
    }),
  })
  return ((await token.json()) as { access_token: string }).access_token
}

export function agentCall(stack: Stack, token: string) {
  let id = 0
  return async (tool: string, args: unknown): Promise<Record<string, unknown>> => {
    const response = await fetch(`${stack.origin}${stack.mcp}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: (id += 1),
        method: "tools/call",
        params: { name: `airdesign_${tool}`, arguments: args },
      }),
    })
    const text = await response.text()
    const line = text.startsWith("{")
      ? text
      : (text
          .split("\n")
          .find((each) => each.startsWith("data: "))
          ?.slice(6) ?? "")
    return (JSON.parse(line) as { result: { structuredContent: Record<string, unknown> } }).result.structuredContent
  }
}
