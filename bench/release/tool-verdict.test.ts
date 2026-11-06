import {it,expect} from "vitest"
import tasks from "../quality/tool-tasks.json"
import {toolVerdict,type ToolTrial} from "../quality/tool-verdict.ts"
it("keeps missing trials and authorization, atomicity and baseline failures in the model verdict",()=>{
 const models=["Claude-pinned","second-model-pinned"],rows:ToolTrial[]=models.flatMap(model=>tasks.tasks.flatMap(task=>[0,1,2].map(trial=>({model,task:task.id,trial,complete:true,authorized:true,atomic:true,baselinePassed:true,firstChangeMs:12}))))
 expect(toolVerdict(tasks.tasks,models,rows).pass).toBe(true)
 expect(toolVerdict(tasks.tasks,models,rows.slice(1)).pass).toBe(false)
 for(const field of ["authorized","atomic","complete"] as const)expect(toolVerdict(tasks.tasks,models,rows.map((row,i)=>i===0?{...row,[field]:false}:row)).pass).toBe(false)
 expect(()=>toolVerdict(tasks.tasks,models,[...rows,rows[0]!])).toThrow("Invalid")
})

import baseline from "./baselines/x03-claude-sonnet-5-5.json"
it("freezes 120 first paid-model outcomes and records only an explicit model waiver",()=>{
 const models=baseline.models.map(model=>model.version),rows=baseline.rows.map(row=>({...row,baselinePassed:row.complete}))
 expect(rows).toHaveLength(120)
 expect(()=>toolVerdict(tasks.tasks,models,rows)).toThrow("two pinned models")
 expect(toolVerdict(tasks.tasks,models,rows,baseline.modelWaiver)).toMatchObject({pass:true,modelWaiver:baseline.modelWaiver})
 expect(toolVerdict(tasks.tasks,models,rows.slice(1),baseline.modelWaiver).pass).toBe(false)
 expect(toolVerdict(tasks.tasks,models,rows.map((row,i)=>i===0?{...row,complete:false}:row),baseline.modelWaiver).pass).toBe(false)
 expect(()=>toolVerdict(tasks.tasks,models,rows,{...baseline.modelWaiver,reason:""})).toThrow()
 const hiddenRegression=rows.map((row,i)=>i===0?{...row,complete:false,baselinePassed:false}:row)
 expect(toolVerdict(tasks.tasks,models,hiddenRegression,baseline.modelWaiver,baseline.rows)).toMatchObject({pass:false,models:[{regressions:[`${rows[0]!.task}:${rows[0]!.trial}`]}]})
})
