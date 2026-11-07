import {renderSiteTerms} from "../../scripts/site-terms.ts"
import assert from "node:assert/strict"
import {readdir,readFile,stat,mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {execFileSync} from "node:child_process"
import {releaseClaimHits,retiredRouteHits} from "../../packages/lint/src/release-claims.ts"
async function walk(root){const results=[];for(const item of await readdir(root,{withFileTypes:true})){const file=path.join(root,item.name);if(item.isDirectory())results.push(...await walk(file));else results.push(file)}return results}
const capabilities=await readFile("docs/release/capabilities.md","utf8")
const claims=JSON.parse(renderSiteTerms(await readFile("apps/site/content/claims.json","utf8"))).claims
const root="apps/site/dist",files=await walk(root),links=[]
for(const file of files.filter(file=>/\.(html|txt)$/.test(file))){
 const source=await readFile(file,"utf8");assert.deepEqual(releaseClaimHits(source,claims,capabilities),[],file)
 for(const match of source.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)){
  const href=match[1];if(!href.startsWith("/"))continue
  if(href.split("?")[0]==="/studio"){links.push({href,status:"Studio deployment route; discovery intent covered by behavior test"});continue}
  const target=path.join(root,href.endsWith("/") ? href+"index.html" : href)
  assert.ok((await stat(target)).isFile(),`${file}: missing ${href}`);links.push({href,status:"exists"})
 }
}
const evidence=process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
const studioFiles=await walk("apps/studio/src"),scanned=[]
for(const file of studioFiles.filter(file=>/\.tsx?$/.test(file)&&!file.includes(".test."))){const source=await readFile(file,"utf8");assert.deepEqual(retiredRouteHits(source),[],file);scanned.push(file)}
const receipt={head,status:"pass",publicClaimAudit:"pass",links,studioRouteAndUiFiles:scanned,bytes:(await Promise.all(files.map(file=>stat(file)))).reduce((total,item)=>total+item.size,0)}
await mkdir(path.join(evidence,"lane-10"),{recursive:true});await writeFile(path.join(evidence,"lane-10/audit.json"),JSON.stringify(receipt,null,2))
console.log(JSON.stringify({head,status:"pass",links:links.length,studioFiles:scanned.length,bytes:receipt.bytes}))
