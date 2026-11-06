import {describe,it,expect} from "vitest"
import release from "../quality/release-set.json"
import {summarize,utility,type Sample} from "../quality/protocol.ts"
describe("frozen release denominator", () => {
  it("has eight tasks in each of six families and three samples", () => {
    expect(release.tasks).toHaveLength(48)
    for (const family of release.families) expect(release.tasks.filter(task=>task.family===family)).toHaveLength(8)
    expect(release.tasks.every(task=>task.samples===3)).toBe(true)
  })
  it("retains missing, malformed-order and hard failures", () => {
    const row:Sample={task:release.tasks[0]!.id,sample:0,hard:true,content:true,editable:true,forward:"win",reverse:"loss"}
    expect(utility(row)).toBe(0)
    expect(utility({...row,reverse:"win",hard:false})).toBe(0)
    const result=summarize(release.tasks,[row])
    expect(result.denominator).toBe(144)
    expect(result.missing).toBe(143)
    expect(result.thresholdsMet).toBe(false)
    expect(result).toEqual(summarize(release.tasks,[row]))
  })
  it("requires both orders, two passing samples, family floors and no dropped cases",()=>{
    const rows:Sample[]=release.tasks.flatMap(task=>[0,1,2].map(sample=>({task:task.id,sample,hard:true,content:true,editable:true,forward:"tie",reverse:"tie"})))
    expect(summarize(release.tasks,rows).thresholdsMet).toBe(true)
    expect(summarize(release.tasks,rows.filter(row=>row.task!==release.tasks[0]!.id)).lower95).toBeLessThan(.5)
    expect(()=>summarize(release.tasks,[...rows,rows[0]!])).toThrow("duplicate")
    expect(()=>summarize(release.tasks.map(task=>({...task,family:"one"})),rows)).toThrow("six families")
  })
})
