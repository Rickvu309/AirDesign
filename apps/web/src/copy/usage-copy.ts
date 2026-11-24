export function usageUsedOf(percent: number): string {
  return `${new Intl.NumberFormat("en", { style: "percent" }).format(percent / 100)} used`
}

export const usageCopy = {
  loading: "Loading usage…",
  seeAll: "See all",
  seeAllName: "See all usage",
  failed: "Unable to load your usage. Check your connection and try again.",
} as const
