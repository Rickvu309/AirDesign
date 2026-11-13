import { readEmail, signInRoutes } from "@airdesign/catalog"
import { appDestination } from "./app-destination"
import { readPendingEmail, readPendingNext, rememberPendingEmail } from "./pending-sign-in-email"

const checkPath = "/sign-in/check"

async function postJson(apiBase: string, path: string, body: object): Promise<Response | null> {
  try {
    return await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    })
  } catch {
    return null
  }
}

export type EmailFailure = "refused" | "failed"

export async function askForSignInEmail(
  apiBase: string,
  email: string,
): Promise<{ readonly path: string } | { readonly failure: EmailFailure }> {
  const response = await postJson(apiBase, signInRoutes.email.path, { email })
  if (response?.status === 202) return { path: checkPath }
  return { failure: response?.status === 400 ? "refused" : "failed" }
}

export async function requestSignInEmail(apiBase: string, email: string): Promise<string | null> {
  const asked = await askForSignInEmail(apiBase, email)
  return "path" in asked ? asked.path : null
}

export async function submitSignInCode(
  apiBase: string,
  appOrigin: string | undefined,
  email: string,
  code: string,
  next: string | null,
): Promise<string | null> {
  const response = await postJson(apiBase, signInRoutes.code.path, { email, code })
  return response?.status === 200 ? appDestination(appOrigin, next) : null
}

let emailInFlight = false

export async function startEmailSignIn(
  apiBase: string,
  email: string,
  go: (path: string) => void,
  onFail: (failure: EmailFailure) => void = () => undefined,
): Promise<void> {
  if (emailInFlight) {
    return
  }
  const checked = readEmail({ email })
  if (!checked.ok) {
    onFail("refused")
    return
  }
  emailInFlight = true
  try {
    const asked = await askForSignInEmail(apiBase, checked.email)
    if ("path" in asked) {
      rememberPendingEmail(checked.email)
      go(asked.path)
      return
    }
    onFail(asked.failure)
  } finally {
    emailInFlight = false
  }
}

export async function submitPendingCode(apiBase: string, code: string): Promise<string | null> {
  const email = readPendingEmail()
  if (email === null) {
    return null
  }
  return submitSignInCode(apiBase, import.meta.env.PUBLIC_APP_ORIGIN, email, code, readPendingNext())
}
