import assert from "node:assert/strict"
import {mkdir,cp,rm,readFile,writeFile,readdir} from "node:fs/promises"
import {spawnSync,execFileSync} from "node:child_process"
import {openSync,closeSync} from "node:fs"
import os from "node:os"
import path from "node:path"
const trunk="fdafe16ccde2b7012d1876ad868215ae745e4d6c",head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),root=process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),directory=path.join(root,"lane-1/trunk"),source=path.join(root,"trunk-source"),archive=path.join(root,"trunk.tar"),rows=[]
await mkdir(directory,{recursive:true});await rm(source,{recursive:true,force:true});await mkdir(source,{recursive:true})
function run(name,command,args){const log=path.join(directory,`${name}.log`),fd=openSync(log,"w"),result=spawnSync(command,args,{cwd:source,env:{...process.env,P05_OUTPUT:directory},stdio:["ignore",fd,fd],timeout:180000});closeSync(fd);rows.push({name,command,args,exit:result.status,log});assert.equal(result.status,0,log)}
try{
 execFileSync("git",["archive",trunk,"--output",archive]);execFileSync("tar",["-xf",archive,"-C",source]);await cp("node_modules",path.join(source,"node_modules"),{recursive:true,verbatimSymlinks:true})
 for(const group of ["apps","packages"])for(const workspace of await readdir(group)){const dependencies=path.join(group,workspace,"node_modules");try{await cp(dependencies,path.join(source,dependencies),{recursive:true,verbatimSymlinks:true})}catch(error){if(error.code!=="ENOENT")throw error}}
 run("studio","npm",["run","build","--workspace","apps/studio"]);run("export-renderer","npm",["run","build:export-renderer"])
 run("import-export",process.execPath,["bench/import-export/browser-check.mjs"])
 const site=execFileSync("git",["ls-tree","-r","--name-only",trunk,"apps/site"],{encoding:"utf8"});assert.equal(site,"")
 await writeFile(path.join(directory,"receipt.json"),JSON.stringify({head,trunk,status:"pass",flow:"actual trunk email session, import first deck, manual title edit, PPTX export/reimport, PDF, retained exports",site:{status:"absent",tree:site},rows,trace:JSON.parse(await readFile(path.join(directory,"trace.json"),"utf8")),cleanup:[source,archive]},null,2));console.log(JSON.stringify({head,trunk,existingWorkflow:"pass",site:"absent"}))
}finally{await rm(source,{recursive:true,force:true});await rm(archive,{force:true})}
