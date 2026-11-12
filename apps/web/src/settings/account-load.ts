import { accountRoutes } from "@airdesign/catalog"

export type AccountLoad =
  | { readonly kind: "account"; readonly email: string }
  | { readonly kind: "signed-out" }
  | { readonly kind: "unavailable" }

const unavailable: AccountLoad = { kind: "unavailable" }

export async function loadAccount(send: typeof fetch = fetch): Promise<AccountLoad> {
  try {
    const response = await send(accountRoutes.agents.path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    const body = (await response.json().catch(() => undefined)) as
      | { ok?: boolean; refusal?: string; account?: { email?: string } }
      | undefined
    if (response.status === 401 && body?.refusal === "session") return { kind: "signed-out" }
    const email = body?.account?.email
    if (response.status !== 200 || typeof email !== "string") return unavailable
    return { kind: "account", email }
  } catch {
    return unavailable
  }
}
