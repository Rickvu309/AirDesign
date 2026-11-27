import { type Origins, serverInfo } from "./server.js"

export function serverCard(endpoint: string, origins: Origins) {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    ...serverInfo(origins),
    remotes: [{ type: "streamable-http", url: endpoint }],
  }
}
