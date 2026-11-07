import {execFileSync} from "node:child_process"
import {mkdtemp,mkdir,rm,writeFile,copyFile} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {readRegistry,parseRegistry,scenarioIdentity,seedFiles} from "./registry.ts"

const output=path.resolve("bench/design-parity/fixtures/history")
await mkdir(output,{recursive:true})
const registry=await readRegistry()
for(const scenario of ["budget","identity","base","landed-lock"]){
  const entries=scenario==="identity" ? registry.map(entry=>({...entry,scenarioChangedBecause:undefined})) : registry
  const cwd=await mkdtemp(path.join(os.homedir(),"tmp/parity-history-generation-"))
  const git=(...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8",stdio:"pipe"}).trim()
  const save=async(file:string,value:unknown)=>writeFile(path.join(cwd,"bench/design-parity",file),JSON.stringify(value))
  const commit=(message:string)=>{git("add",".");git("commit","--allow-empty","-m",message)}
  const mark=(name:string)=>git("branch",name)
  try{
    git("init","-b","main")
    await mkdir(path.join(cwd,"bench/design-parity"),{recursive:true})
    if(scenario==="budget"){
      const entry=entries[0]!
      await save("budget-baseline.json",Object.fromEntries(entries.map(value=>[value.code,1])))
      await save("scenarios.json",[{...entry,budget:0.1}]);commit("Record reviewed budget");mark("reviewed")
      await save("scenarios.json",[{...entry,budget:0.9}]);commit("Record unauthorized increase");mark("increase")
      commit("Record repeated unauthorized increase");mark("repeated")
    }else if(scenario==="identity"){
      for(const file of seedFiles){await mkdir(path.dirname(path.join(cwd,file)),{recursive:true});await copyFile(file,path.join(cwd,file))}
      const record=async(value:unknown)=>{await save("scenarios.json",value);await save("scenario-lock.json",parseRegistry(value).map(scenarioIdentity));commit("Record scenarios")}
      const first=entries[0]!
      await record(entries.map(entry=>entry.code===first.code ? {...entry,viewport:{width:1,height:1}} : entry));mark("reviewed")
      commit("Advance feature");mark("feature")
      git("checkout","reviewed")
      const unreachable=entries.find(entry=>entry.status==="unreachable")!
      await record(entries.map(entry=>entry.code===unreachable.code ? {...entry,status:"reachable",steps:[]} : entry));mark("coverage-reviewed")
      commit("Advance coverage feature");mark("coverage")
    }else if(scenario==="base"){
      commit("Reviewed ceiling");mark("reviewed")
      commit("Raise ceiling");mark("feature")
      commit("Descendant");mark("descendant")
    }else{
      for(const file of seedFiles){await mkdir(path.dirname(path.join(cwd,file)),{recursive:true});await copyFile(file,path.join(cwd,file))}
      await save("scenario-lock.json",entries.map(scenarioIdentity))
      await save("scenarios.json",entries.map(value=>({...value,budget:0.1})))
      commit("First reviewed lock");mark("reviewed")
      commit("Change after landing");mark("feature")
    }
    git("bundle","create",path.join(output,`${scenario}.bundle`),"--branches")
  }finally{await rm(cwd,{recursive:true,force:true})}
}
