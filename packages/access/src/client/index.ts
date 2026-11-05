import { isIntentKind, intentKinds, type IntentKind } from "../intent-kinds.ts"

export { isIntentKind, intentKinds, type IntentKind }

export type CheckEmailResult =
  | { status: "check-email"; resendAvailableAt: number }
  | { status: "email-invalid" | "intent-rejected" | "guard-rejected" }

export type VerifyResult =
  | { status: "signed-in"; personId: string; intentToken: string; kind: IntentKind }
  | { status: "invalid-code"; screen: "S22.01" }
  | { status: "link-expired" | "link-used"; screen: "S29.01"; intentToken: string | null; kind: IntentKind | null }
  | { status: "intent-rejected" | "guard-rejected" }

export type SessionResult =
  | { status: "signed-in"; personId: string; email: string; displayName: string; freeUsageWeekStartedAt: string | null }
  | { status: "signed-out" }

export type PersonResult = { status: "ok"; personId: string; displayName: string } | { status: "not-found" }

export type DeletionResult =
  | { status: "deleted" | "confirmation-required" | "signed-out" }
  | { status: "blocked"; gate: "X06" }

export type AccessClient = {
  issueIntent(kind: IntentKind): Promise<{ status: "issued"; token: string; kind: IntentKind } | { status: "intent-rejected" }>
  sendEmail(email: string, intent: string): Promise<CheckEmailResult>
  submitCode(email: string, code: string, intent: string): Promise<VerifyResult>
  consumeLink(token: string): Promise<VerifyResult>
  session(): Promise<SessionResult>
  revoke(): Promise<{ status: "signed-out" }>
  account(): Promise<SessionResult>
  readPerson(personId: string): Promise<PersonResult>
  updatePerson(personId: string, displayName: string): Promise<PersonResult | { status: "invalid-name" }>
  deleteAccount(confirm: string): Promise<DeletionResult>
}

export function createAccessClient(baseUrl: string): AccessClient {
  const request = async <T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> => {
    const init: RequestInit = { method, credentials: "include" }
    if (body !== undefined) {
      init.headers = { "content-type": "application/json" }
      init.body = JSON.stringify(body)
    }
    const response = await fetch(`${baseUrl}${path}`, init)
    return await response.json() as T
  }
  return {
    issueIntent(kind) {
      return request("/api/access/intent", "POST", { kind })
    },
    sendEmail(email, intent) {
      return request("/api/access/email", "POST", { email, intent })
    },
    submitCode(email, code, intent) {
      return request("/api/access/code", "POST", { email, code, intent })
    },
    consumeLink(token) {
      return request("/api/access/consume-link", "POST", { token })
    },
    session() {
      return request("/api/session", "GET")
    },
    revoke() {
      return request("/api/session/revoke", "POST", {})
    },
    account() {
      return request("/api/account", "GET")
    },
    readPerson(personId) {
      return request(`/api/people/${encodeURIComponent(personId)}`, "GET")
    },
    updatePerson(personId, displayName) {
      return request(`/api/people/${encodeURIComponent(personId)}/profile`, "POST", { displayName })
    },
    deleteAccount(confirm) {
      return request("/api/account/deletion", "POST", { confirm })
    },
  }
}
