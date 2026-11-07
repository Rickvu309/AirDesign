export function relativeTime(timestamp:number,now=Date.now()) {
  const days=Math.max(0,(now-timestamp)/86400000)
  if(days<1/1440)return "just now"
  if(days<1/24){const minutes=Math.floor(days*1440);return `${minutes} ${minutes===1 ? "minute" : "minutes"} ago`}
  if(days<1){const hours=Math.floor(days*24);return `${hours} ${hours===1 ? "hour" : "hours"} ago`}
  if(days<2)return "yesterday"
  if(days<7)return `${Math.floor(days)} days ago`
  if(days<14)return "last week"
  if(days<28)return `${Math.floor(days/7)} weeks ago`
  if(days<60)return "last month"
  return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(timestamp)
}
