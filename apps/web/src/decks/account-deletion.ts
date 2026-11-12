import { accountRoutes } from "@airdesign/catalog"

export type Deletion = "deleted" | "signed-out" | "refused"

export function matchesEmail(typed: string, email: string): boolean {
  return email !== "" && typed.trim().toLowerCase() === email
}

export async function askDeletion(email: string, send: typeof fetch = fetch): Promise<Deletion> {
  try {
    const response = await send(accountRoutes.delete.path, {
      method: accountRoutes.delete.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    })
    if (response.ok) return "deleted"
    return response.status === 401 ? "signed-out" : "refused"
  } catch {
    return "refused"
  }
}
