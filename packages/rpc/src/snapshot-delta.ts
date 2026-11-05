import type { Snapshot } from "./client.ts"
export function snapshotDelta(snapshot:Snapshot,base:number|null) {
  const contributions=snapshot.contributions
  if(base===null || !contributions)return snapshot
  const history=contributions.history
  return {...snapshot,contributions:{applied:contributions.applied,history:{base,seq:history.seq,events:history.events.filter(event=>event.seq>base||event.toggledAt>base),runs:history.runs,usedIds:history.usedIds}}}
}
