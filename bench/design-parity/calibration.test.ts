import {execFileSync} from "node:child_process"
import {mkdtemp,readFile,rm} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {expect,it} from "vitest"
import {z} from "zod"
import {sourceFloors,floorSchema} from "./targets.ts"
import {fixedMargin,sourceTarget,sourceVerdict,validateSourceFloor} from "./source-floor.mjs"
it("recomputes every available source floor independently of committed targets and product captures",async()=>{
  const directory=await mkdtemp(path.join(os.homedir(),"tmp/parity-calibration-"))
  try{
    execFileSync(process.execPath,["bench/design-parity/calibrate.mjs","unused",directory,"--references-only"],{stdio:"pipe",timeout:600000})
    const fresh=z.object({fixedMargin:z.literal(0.01),results:z.array(floorSchema)}).parse(JSON.parse(await readFile(path.join(directory,"calibration.json"),"utf8")))
    for(const row of fresh.results)validateSourceFloor(row)
    const measurementSchema=z.discriminatedUnion("status",[floorSchema.options[0],floorSchema.options[1].omit({captureSha256:true,repeatSha256:true})])
    expect(fresh.results.map(row=>measurementSchema.parse(row))).toEqual(sourceFloors.map(row=>measurementSchema.parse(row)))
    const mappings=z.object({results:z.array(z.object({code:z.string(),file:z.string().optional(),label:z.string().optional(),status:z.string()}))}).parse(JSON.parse(await readFile(path.join(directory,"calibration.json"),"utf8")))
    const exactFiles={"S11.01":"ed39.jsx","S12.01":"ed21.jsx","S29.01":"ed28.jsx","S41.01":"ed3.jsx","S41.02":"ed5.jsx","S41.03":"ed6.jsx","S41.04":"ed13.jsx","S42.01":"ed1.jsx","S42.02":"ed2.jsx","S42.03":"ed35.jsx","S42.04":"ed38.jsx","S43.01":"ed4.jsx","S43.02":"ed9.jsx","S43.03":"ed30.jsx","S43.04":"ed31.jsx","S43.05":"ed32.jsx","S43.06":"ed33.jsx","S43.07":"ed34.jsx","S49.01":"ed24.jsx","S49.02":"ed27.jsx","S61.01":"ed14.jsx","S61.02":"ed16.jsx","S61.03":"ed15.jsx","S69.01":"ed26.jsx","S71.01":"ed17.jsx","S71.02":"ed18.jsx","S71.03":"ed20.jsx","S92.01":"ed22.jsx","S92.03":"ed23.jsx","S92.04":"ed36.jsx"}
    expect(Object.fromEntries(mappings.results.filter(row=>row.file!==undefined).map(row=>[row.code,row.file]))).toEqual(exactFiles)
    for(const row of mappings.results.filter(row=>row.status==="calibrated"))expect(row.label?.startsWith(row.code==="S12.01" ? "S01.02 Pricing, free usage" : row.code+" ")).toBe(true)
    expect(fresh.results.find(row=>row.code==="S12.01")?.status).toBe("calibrated")
    expect(fresh.results.find(row=>row.code==="S29.01")?.status).toBe("calibrated")
    expect(fresh.results.find(row=>row.code==="S81.01")?.status).toBe("uncalibrated")
  }finally{await rm(directory,{recursive:true,force:true})}
},620000)
it("rejects manual loosening even infinitesimally above the exact source floor plus shared margin",()=>{
  const row=sourceFloors.find(row=>row.status==="calibrated")!
  if(row.status!=="calibrated")throw new Error("missing-calibration")
  expect(fixedMargin).toBe(0.01)
  expect(sourceTarget(row.floor)).toBe(row.target)
  expect(sourceVerdict(row,row.floor)).toBe("pass")
  expect(sourceVerdict(row,row.target+Number.EPSILON)).toBe("fail")
  expect(()=>validateSourceFloor({...row,target:row.target+Number.EPSILON})).toThrow("invalid-source-floor")
  expect(()=>validateSourceFloor({...row,target:Math.ceil(row.target*100)/100+0.01})).toThrow("invalid-source-floor")
  expect(()=>validateSourceFloor({...row,repeatIdentical:false})).toThrow("invalid-source-floor")
  expect(()=>validateSourceFloor({...row,repeatSha256:"different-render"})).toThrow("invalid-source-floor")
})
it("reports missing sources as uncalibrated regardless of product score",()=>{
  const row={code:"S00.00",status:"uncalibrated",floor:null,target:null,reason:"no complete generator"} satisfies z.infer<typeof floorSchema>
  expect(sourceVerdict(row,0)).toBe("uncalibrated")
  expect(sourceVerdict(row,1)).toBe("uncalibrated")
})

it("rejects unusable source floors at the inclusive 0.9 boundary without a passing target",()=>{
  const row=sourceFloors.find(row=>row.status==="calibrated")!
  expect(sourceTarget(0.899999)).toBe(0.909999)
  for(const floor of [0.9,0.9787472750775135,1]){
    expect(()=>sourceTarget(floor)).toThrow("unusable-source-floor")
    const forged={...row,status:"calibrated",floor,target:floor+fixedMargin,repeatIdentical:true,captureSha256:"same",repeatSha256:"same"} satisfies z.infer<typeof floorSchema>
    expect(()=>sourceVerdict(forged,0)).toThrow("invalid-source-floor")
  }
  for(const code of ["S11.01","S43.03","S43.05","S43.06","S92.03"]){
    const rejected=sourceFloors.find(row=>row.code===code)!
    expect(rejected.status).toBe("uncalibrated")
    expect(rejected.floor).toBeNull()
    expect(rejected.target).toBeNull()
    if(rejected.status!=="uncalibrated")throw new Error("expected-unusable-source")
    expect(rejected.reason).toContain("source-render-mismatch")
    expect(sourceVerdict(rejected,0)).toBe("uncalibrated")
    expect(sourceVerdict(rejected,1)).toBe("uncalibrated")
  }
})
