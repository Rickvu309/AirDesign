import { accountRoutes } from "@airdesign/catalog"

export type AccountLoad =
  | { readonly kind: "account"; readonly email: string; readonly name: string | null }
  | { readonly kind: "signed-out" }
  | { readonly kind: "unavailable" }

const unavailable: AccountLoad = { kind: "unavailable" }

export async function loadAccount(send: typeof fetch = fetch): Promise<AccountLoad> {
  try {
    const response = await send(accountRoutes.profile.path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    const body: unknown = await response.json().catch(() => undefined)
    if (typeof body !== "object" || body === null) return unavailable
    if (response.status === 401 && "refusal" in body && body.refusal === "session") return { kind: "signed-out" }
    if (response.status !== 200 || !("account" in body) || typeof body.account !== "object" || body.account === null)
      return unavailable
    const account = body.account
    if (!("email" in account) || typeof account.email !== "string" || !("name" in account)) return unavailable
    const { email, name } = account
    if (name !== null && typeof name !== "string") return unavailable
    return { kind: "account", email, name }
  } catch {
    return unavailable
  }
}
