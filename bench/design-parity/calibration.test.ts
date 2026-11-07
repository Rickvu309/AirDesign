import {execFileSync} from "node:child_process"
import {mkdtemp,readFile,rm} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {expect,it} from "vitest"
import {z} from "zod"
import {surfaceTargets,scenarioTargets} from "./targets.ts"
it("recomputes calibration from PNGs and source renders instead of trusting co-edited targets and reports",async()=>{
  const directory=await mkdtemp(path.join(os.homedir(),"tmp/parity-calibration-"))
  try{
    execFileSync(process.execPath,["bench/design-parity/calibrate.mjs","unused",directory,"--references-only"],{stdio:"pipe",timeout:480000})
    const fresh=z.object({targets:z.object({site:z.number(),studio:z.number()}),results:z.array(z.object({code:z.string(),reference:z.object({score:z.number()})})),editor:z.array(z.object({code:z.string(),score:z.number()}))}).parse(JSON.parse(await readFile(path.join(directory,"calibration.json"),"utf8")))
    expect(fresh.results).toHaveLength(Object.keys(scenarioTargets).length)
    expect(fresh.editor).toHaveLength(2)
    process.stdout.write(JSON.stringify({faithfulReferences:fresh.results.length,freshTargets:fresh.targets,editor:fresh.editor,maximumShift:Math.max(...fresh.results.map(row=>row.reference.score))})+"\n")
    for(const row of fresh.results){
      const maximum=Math.max(row.reference.score,...fresh.editor.filter(editor=>editor.code===row.code).map(editor=>editor.score))
      expect(maximum).toBeLessThanOrEqual(scenarioTargets[row.code]!)
      expect(scenarioTargets[row.code]).toBeLessThanOrEqual((Math.ceil(maximum*100)+1)/100)
    }
    const surfaces:(keyof typeof surfaceTargets)[]=["site","studio"]
    for(const surface of surfaces){
      expect(surfaceTargets[surface]).toBeLessThanOrEqual(fresh.targets[surface])
    }
  }finally{await rm(directory,{recursive:true,force:true})}
},500000)
