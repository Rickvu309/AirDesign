import { serverInfo } from "./server.js"

export function serverCard(endpoint: string, website: string) {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: "app.airdesign/studio",
    version: serverInfo.version,
    title: "AirDesign",
    description: "Make and edit slide decks without doing the design work.",
    websiteUrl: website,
    remotes: [{ type: "streamable-http", url: endpoint }],
  }
}
