import {it,expect} from "vitest"
import {calibrate,type Rating} from "../quality/calibration.ts"
function ratings():Rating[]{return Array.from({length:120},(_,i)=>(["designer-1","designer-2","target-reader"] as const).map(rater=>({pair:String(i),rater,overall:i%2?4:5,axes:[4,4,4,4,4],hardDefects:0,human:"win" as const,judge:"win" as const}))).flat()}
it("checks independent calibration and ordinal agreement before eligibility",()=>{
 const rows=ratings();expect(calibrate(rows)).toMatchObject({accepted:120,alpha:1,agreement:1,judgeEligible:true})
 expect(()=>calibrate(rows.slice(1))).toThrow()
 expect(()=>calibrate(rows.map(row=>({...row,rater:"designer-1"})))).toThrow("independent")
 expect(calibrate(rows.map(row=>({...row,hardDefects:1}))).judgeEligible).toBe(false)
 expect(calibrate(rows.map(row=>({...row,judge:"loss"}))).judgeEligible).toBe(false)
 expect(calibrate(rows.map(row=>({...row,overall:4}))).judgeEligible).toBe(false)
})
