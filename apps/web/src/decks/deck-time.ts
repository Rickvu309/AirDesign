const dayLength = 86400000
const hourLength = 3600000
const trashDays = 30

function age(then: number, now: number) {
  const days = Math.max(0, Math.floor((now - then) / dayLength))
  const hours = Math.max(0, Math.floor((now - then) / hourLength))
  if (days >= 30) return "last month"
  if (days >= 14) return `${Math.floor(days / 7)} weeks ago`
  if (days >= 7) return "last week"
  if (days >= 2) return `${days} days ago`
  if (days === 1) return "yesterday"
  if (hours === 1) return "1 hour ago"
  if (hours > 1) return `${hours} hours ago`
  return "just now"
}

export function deckTime(iso: string, now: number) {
  const time = Date.parse(iso)
  const words = age(time, now)
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(time)
  const older = now - time >= 30 * dayLength
  const left = Math.max(0, trashDays - Math.floor(Math.max(0, now - time) / dayLength))
  return {
    row: older ? date : `${words.charAt(0).toUpperCase()}${words.slice(1)}`,
    card: older ? `Edited on ${date}` : `Edited ${words}`,
    created:
      new Date(time).getUTCFullYear() === new Date(now).getUTCFullYear()
        ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(time)
        : date,
    trash: `Deleted ${words}, ${left} ${left === 1 ? "day" : "days"} left`,
  }
}
