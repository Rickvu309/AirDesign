export type UsageWeek = { id: string; zone: string; startsAt: number; resetsAt: number }
function localParts(instant: number, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(instant)
  const get = (name: string) => Number(parts.find(part => part.type === name)?.value)
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") }
}
function wallInstant(day: number, zone: string): number {
  const target = day + 8 * 3600000
  const rendered=(instant:number)=>{const parts=localParts(instant,zone);return Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second)}
  const offsets=new Set<number>()
  for(const hours of [-48,-24,0,24,48]){const instant=target+hours*3600000;offsets.add(rendered(instant)-instant)}
  const matches=[...offsets].map(offset=>target-offset).filter(instant=>rendered(instant)===target)
  if(matches.length)return Math.min(...matches)
  const candidates=[...offsets].map(offset=>target-offset).sort((a,b)=>a-b)
  const start=candidates[0],end=candidates.at(-1)
  if(start===undefined||end===undefined)throw new Error("unsupported-week-boundary")
  let low=start,high=end
  while(high-low>1000){const middle=Math.floor((low+high)/2000)*1000;if(rendered(middle)>=target)high=middle;else low=middle+1000}
  return rendered(low)>=target ? low : high
}
export function usageWeek(now: number, zone: string): UsageWeek {
  const parts = localParts(now, zone)
  const day = Date.UTC(parts.year, parts.month - 1, parts.day)
  const weekday = (new Date(day).getUTCDay() + 6) % 7
  let monday = day - weekday * 86400000
  if (now < wallInstant(monday, zone)) monday -= 7 * 86400000
  const startsAt = wallInstant(monday, zone)
  return { id: `${zone}:${new Date(monday).toISOString().slice(0, 10)}`, zone, startsAt, resetsAt: wallInstant(monday + 7 * 86400000, zone) }
}
