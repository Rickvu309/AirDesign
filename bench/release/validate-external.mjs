import {readFile,stat} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
const id=process.argv[2]
if(!/^X0[1-6]$/.test(id??""))throw new Error("Pass X01..X06")
const root=path.join(process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),"external",id),receipt=JSON.parse(await readFile(path.join(root,"receipt.json"),"utf8"))
if(receipt.status==="blocked"){console.log(JSON.stringify(receipt));process.exitCode=2}else{
 const index=JSON.parse(await readFile(path.join(root,"results/index.json"),"utf8"))
 if(!index.authorization||!index.environment||!index.operator||!receipt.expectedPredicates.every(predicate=>index.evidence?.some(row=>row.predicate===predicate&&row.path)))throw new Error("Incomplete operator evidence")
 for(const row of index.evidence){const resolved=path.resolve(root,"results",row.path);if(!resolved.startsWith(path.resolve(root,"results")+path.sep))throw new Error("Artifact escapes results");await stat(resolved)}
 console.log(JSON.stringify({status:"inventory-complete",acceptance:"requires operator review; not inferred"}))
}
