import { mcpRoutes, oauthAuthorizePath, oauthRoutes } from "@airdesign/catalog"

type Settings = { readonly resource: string; readonly publicOrigin: string }

export function resourceMetadata(settings: Settings) {
  return {
    resource: settings.resource,
    authorization_servers: [settings.publicOrigin],
    bearer_methods_supported: ["header"],
  }
}

export function authorizationMetadata({ publicOrigin }: Settings) {
  return {
    issuer: publicOrigin,
    authorization_endpoint: publicOrigin + oauthAuthorizePath,
    token_endpoint: publicOrigin + oauthRoutes.token.path,
    registration_endpoint: publicOrigin + oauthRoutes.register.path,
    revocation_endpoint: publicOrigin + oauthRoutes.revoke.path,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  }
}

export function resourceChallenge({ resource }: Settings, error?: "invalid_token"): string {
  const metadata = new URL(mcpRoutes.resourceMetadata.path, resource).href
  return `Bearer resource_metadata="${metadata}"${error === undefined ? "" : `, error="${error}"`}`
}
