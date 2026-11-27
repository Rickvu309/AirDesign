import type { Good } from "./fuzz-good.js"

export const discoveryFuzzGood = {
  "GET /.well-known/oauth-protected-resource": [{ shape: "none", answers: 200 }],
  "GET /.well-known/oauth-protected-resource/mcp": [{ shape: "none", answers: 200 }],
  "GET /.well-known/oauth-authorization-server": [{ shape: "none", answers: 200 }],
  "any /mcp/server-card": [{ method: "GET", shape: "none", answers: 200, says: "app.airdesign/studio" }],
} satisfies Record<string, readonly Good[]>
