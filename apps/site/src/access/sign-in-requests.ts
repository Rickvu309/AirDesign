import { appDestination } from "./app-destination"

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
