import assert from "node:assert/strict"
import {mkdir,readFile,writeFile,rm} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"
import {pathToFileURL} from "node:url"
import {getDocument} from "pdfjs-dist/legacy/build/pdf.mjs"
const root=process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),directory=path.join(root,"libreoffice"),profile=path.join(directory,"profile"),input=path.join(root,"import-export/saved.pptx"),binary=path.join(os.homedir(),"tmp/tools/libreoffice/soffice-local"),head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
await mkdir(directory,{recursive:true});await rm(path.join(directory,"saved.pdf"),{force:true})
try{
 const version=execFileSync(binary,["--version"],{encoding:"utf8",timeout:30000}),stdout=execFileSync(binary,[`-env:UserInstallation=${pathToFileURL(profile).href}`,"--headless","--convert-to","pdf","--outdir",directory,input],{encoding:"utf8",timeout:120000}),bytes=await readFile(path.join(directory,"saved.pdf")),document=await getDocument({data:new Uint8Array(bytes),useSystemFonts:false}).promise,text=[]
 for(let i=1;i<=document.numPages;i++)text.push((await(await document.getPage(i)).getTextContent()).items.map(item=>"str" in item?item.str:"").join(" "))
 assert.ok(text.some(value=>value.includes("Edited imported title")))
 await writeFile(path.join(directory,"receipt.json"),JSON.stringify({head,status:"pass",version,stdout,pages:document.numPages,text,inputSha256:createHash("sha256").update(await readFile(input)).digest("hex"),pdfSha256:createHash("sha256").update(bytes).digest("hex"),scope:"LibreOffice fast check only; Windows/Mac PowerPoint remains blocked-X01"},null,2));await document.cleanup();console.log(JSON.stringify({head,libreoffice:"pass",pages:text.length}))
}finally{await rm(profile,{recursive:true,force:true})}
