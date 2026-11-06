export type ToolTrial = {model:string;task:string;trial:number;complete:boolean;authorized:boolean;atomic:boolean;baselinePassed:boolean;firstChangeMs:number|null}
export type ModelWaiver={operator:string;reason:string;models:readonly string[]}
export function toolVerdict(tasks:readonly {id:string;kind:string}[],models:readonly string[],rows:ToolTrial[],modelWaiver?:ModelWaiver,baseline?:readonly Pick<ToolTrial,"model"|"task"|"trial"|"complete">[]) {
 if(tasks.length<40||new Set(tasks.map(task=>task.id)).size!==tasks.length||(models.length<2&&!(models.length===1&&modelWaiver?.operator.trim()&&modelWaiver.reason.trim()&&modelWaiver.models.length===1&&modelWaiver.models[0]===models[0]))||new Set(models).size!==models.length||!models.some(model=>/claude/i.test(model)))throw new Error("40 distinct tasks and two pinned models including Claude required")
 if(baseline)rows=rows.map(row=>({...row,baselinePassed:baseline.some(prior=>prior.model===row.model&&prior.task===row.task&&prior.trial===row.trial&&prior.complete)}))
 const keys=new Set<string>()
 for(const row of rows){const key=`${row.model}:${row.task}:${row.trial}`;if(keys.has(key)||!models.includes(row.model)||!tasks.some(task=>task.id===row.task)||![0,1,2].includes(row.trial)||![row.complete,row.authorized,row.atomic,row.baselinePassed].every(value=>typeof value==="boolean")||(row.firstChangeMs!==null&&(!Number.isFinite(row.firstChangeMs)||row.firstChangeMs<0)))throw new Error("Invalid tool trial");keys.add(key)}
 const results=models.map(model=>{
  const observed=rows.filter(row=>row.model===model),denominator=tasks.length*3,completion=observed.filter(row=>row.complete).length/denominator,authorization=observed.filter(row=>row.authorized).length/denominator,atomicity=observed.filter(row=>row.atomic).length/denominator,regressions=observed.filter(row=>row.baselinePassed&&!row.complete).map(row=>`${row.task}:${row.trial}`)
  return {model,denominator,observed:observed.length,completion,authorization,atomicity,regressions,pass:observed.length===denominator&&completion>=.9&&authorization===1&&atomicity===1&&regressions.length===0,firstChangeMs:observed.map(row=>row.firstChangeMs).filter(value=>value!==null)}
 })
 return {models:results,...modelWaiver?{modelWaiver}:{},pass:results.every(result=>result.pass)}
}
