export function usageUsedOf(percent: number): string {
  return `${new Intl.NumberFormat("en", { style: "percent" }).format(percent / 100)} used`
}

export const usageCopy = {
  seeAll: "See all",
  seeAllName: "See all usage",
  runsOutTitle: "When usage runs out",
  runsOutBody:
    "Only requests to Aira count. When usage runs out, Aira takes no new requests until it resets. You can still edit your decks, and agents you connect keep working.",
  failed: "Unable to load your usage. Check your connection and try again.",
} as const
