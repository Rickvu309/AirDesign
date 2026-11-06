export type Rating = {pair:string;rater:"designer-1"|"designer-2"|"target-reader";overall:number;axes:number[];hardDefects:number;human:"win"|"tie"|"loss";judge:"win"|"tie"|"loss"|"unresolved"}
export function calibrate(rows:Rating[]) {
  const pairs=[...new Set(rows.map(row=>row.pair))]
  if(pairs.length!==120||rows.length!==360)throw new Error("120 pairs and three raters required")
  const grouped=pairs.map(pair=>rows.filter(row=>row.pair===pair))
  if(grouped.some(group=>group.length!==3||new Set(group.map(row=>row.rater)).size!==3))throw new Error("independent rater roles required")
  for(const row of rows)if(!["designer-1","designer-2","target-reader"].includes(row.rater)||!["win","tie","loss"].includes(row.human)||!["win","tie","loss","unresolved"].includes(row.judge)||![row.overall,...row.axes].every(value=>Number.isInteger(value)&&value>=1&&value<=5)||row.axes.length!==5||!Number.isInteger(row.hardDefects)||row.hardDefects<0)throw new Error("invalid rating")
  const median=(values:number[])=>values.toSorted((a,b)=>a-b)[1]!
  const accepted=grouped.filter(group=>median(group.map(row=>row.overall))>=4&&[0,1,2,3,4].every(axis=>median(group.map(row=>row.axes[axis]!))>=4)&&group.every(row=>row.hardDefects===0)).length
  const counts=Array.from({length:5},(_,i)=>rows.filter(row=>row.overall===i+1).length)
  const distance=(a:number,b:number)=>a===b?0:Math.pow(counts.slice(Math.min(a,b)-1,Math.max(a,b)).reduce((sum,n)=>sum+n,0)-(counts[a-1]!+counts[b-1]!)/2,2)
  const observed=grouped.reduce((sum,group)=>sum+group.reduce((total,a)=>total+group.filter(b=>b!==a).reduce((n,b)=>n+distance(a.overall,b.overall),0),0)/6,0)/120
  const expected=counts.reduce((sum,n,a)=>sum+counts.reduce((total,m,b)=>total+(a===b? n*(m-1):n*m)*distance(a+1,b+1),0),0)/(360*359)
  const alpha=expected===0?null:1-observed/expected
  const decisive=grouped.filter(group=>group.every(row=>row.human===group[0]!.human)&&group[0]!.human!=="tie")
  const agreement=decisive.length===0?null:decisive.filter(group=>group.every(row=>row.judge===group[0]!.human)).length/decisive.length
  return {pairs:120,ratings:360,accepted,alpha,decisivePairs:decisive.length,agreement,judgeEligible:accepted>=96&&alpha!==null&&alpha>=.6&&agreement!==null&&agreement>=.8}
}
