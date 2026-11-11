export type OAuthError = "unsupported_response_type" | "invalid_request" | "access_denied"
export type OAuthRequestError = Exclude<OAuthError, "access_denied">

export function authorizationError(parameters: URLSearchParams): OAuthRequestError | null {
  if (parameters.get("response_type") !== "code") return "unsupported_response_type"
  if (!parameters.get("code_challenge") || parameters.get("code_challenge_method") !== "S256") return "invalid_request"
  return null
}

export function oauthErrorRedirect(redirectUri: string, error: OAuthError, state: string | null): string {
  const redirect = new URL(redirectUri)
  redirect.searchParams.set("error", error)
  if (state !== null) redirect.searchParams.set("state", state)
  return redirect.href
}
