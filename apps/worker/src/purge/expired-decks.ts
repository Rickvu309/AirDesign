import type { createCatalog } from "../../../../packages/catalog/src/index.ts"

export async function purgeExpiredDecks(catalog:Pick<ReturnType<typeof createCatalog>,"purge">) {
  return {removed:await catalog.purge()}
}
