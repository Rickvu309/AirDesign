export function deckTime(iso: string, now: number) {
  const time = Date.parse(iso)
  const days = Math.max(0, Math.floor((now - time) / 86400000))
  const hours = Math.max(0, Math.floor((now - time) / 3600000))
  const row =
    days >= 30
      ? "Last month"
      : days >= 14
        ? `${Math.floor(days / 7)} weeks ago`
        : days >= 7
          ? "Last week"
          : days >= 2
            ? `${days} days ago`
            : days === 1
              ? "Yesterday"
              : hours >= 1
                ? `${hours} hours ago`
                : "Just now"
  return {
    row,
    card: `Edited ${row.charAt(0).toLowerCase()}${row.slice(1)}`,
    created: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(time),
    trash: `Deleted ${days} days ago, ${Math.max(0, 30 - days)} days left`,
  }
}
