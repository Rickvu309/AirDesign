export const discoveryFuzzGood = {
  "GET /.well-known/oauth-protected-resource": [{ shape: "none", answers: 200 }],
  "GET /.well-known/oauth-protected-resource/mcp": [{ shape: "none", answers: 200 }],
  "GET /.well-known/oauth-authorization-server": [{ shape: "none", answers: 200 }],
} satisfies Record<string, readonly { shape: "none"; answers: number }[]>
