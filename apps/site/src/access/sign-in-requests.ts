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

export async function requestSignInEmail(apiBase: string, email: string): Promise<string | null> {
  const response = await postJson(apiBase, "/sign-in/email", { email })
  return response?.status === 202 ? checkPath : null
}

export async function submitSignInCode(
  apiBase: string,
  appOrigin: string | undefined,
  email: string,
  code: string,
  next: string | null,
): Promise<string | null> {
  const response = await postJson(apiBase, "/sign-in/code", { email, code })
  return response?.status === 200 ? appDestination(appOrigin, next) : null
}

let emailInFlight = false

export async function startEmailSignIn(apiBase: string, email: string, go: (path: string) => void): Promise<void> {
  if (emailInFlight) {
    return
  }
  emailInFlight = true
  try {
    const destination = await requestSignInEmail(apiBase, email)
    if (destination !== null) {
      rememberPendingEmail(email)
      go(destination)
    }
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
