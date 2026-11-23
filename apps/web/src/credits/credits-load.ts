import { creditsRoutes, readCredits, type Credits } from "@airdesign/catalog"
import { fieldsOf } from "@/lib/fields-of"

export type CreditsLoad =
  | { readonly kind: "credits"; readonly credits: Credits }
  | { readonly kind: "signed-out" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "refused"; readonly refusal: string }

export type CreditsChange =
  | { readonly kind: "reset"; readonly once: string }
  | { readonly kind: "autoReset"; readonly enabled: boolean }

async function request(path: string, body: unknown, send: typeof fetch): Promise<CreditsLoad> {
  try {
    const response = await send(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const result = fieldsOf(await response.json())
    if (response.status === 401 && result?.refusal === "session") return { kind: "signed-out" }
    if (response.status === 409 && typeof result?.refusal === "string")
      return { kind: "refused", refusal: result.refusal }
    const credits = readCredits(result?.credits)
    if (!response.ok || result?.ok !== true || credits === undefined) return { kind: "unavailable" }
    return { kind: "credits", credits }
  } catch {
    return { kind: "unavailable" }
  }
}

export function loadCredits(send: typeof fetch = fetch): Promise<CreditsLoad> {
  return request(creditsRoutes.read.path, {}, send)
}

export function changeCredits(change: CreditsChange, send: typeof fetch = fetch): Promise<CreditsLoad> {
  return change.kind === "reset"
    ? request(creditsRoutes.reset.path, { once: change.once }, send)
    : request(creditsRoutes.autoReset.path, { enabled: change.enabled }, send)
}
