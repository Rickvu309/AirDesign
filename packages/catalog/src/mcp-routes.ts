export const oauthAuthorizePath = "/oauth/authorize"

export const mcpRoutes = {
  mcp: { path: "/mcp", method: "POST" },
  resourceMetadata: { path: "/.well-known/oauth-protected-resource", method: "GET" },
  authorizationMetadata: { path: "/.well-known/oauth-authorization-server", method: "GET" },
} as const

export const mcpPaths: readonly string[] = Object.values(mcpRoutes).map((route) => route.path)
