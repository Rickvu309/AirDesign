import {readFile,writeFile} from "node:fs/promises"
import path from "node:path"
import vm from "node:vm"
import {createHash} from "node:crypto"
import {compile} from "@tailwindcss/node"
import {chromium} from "playwright"
import sharp from "sharp"

const generatorPath="docs/design/v0.1/source/gen-editor.mjs"
const postprocessorPath="docs/design/v0.1/source/landing-post.sh"
const copyPath="docs/design/v0.1/copy-kit.json"
const [generator,postprocessor,copy]=await Promise.all([generatorPath,postprocessorPath,copyPath].map(file=>readFile(file,"utf8")))
const generated=new Map()
const source=generator.replace("import fs from 'node:fs';","")
vm.runInNewContext(source,{fs:{readFileSync:file=>file.endsWith("copy_kit.json")?copy:"",writeFileSync:(file,value)=>generated.set(path.basename(file),value)}})
const editor=generated.get("ed1.jsx"),overlay=generated.get("ed54.jsx")
if(!editor||!overlay)throw new Error("Missing editor or Run 04 design source")
const slot='<div data-node-label="Shot" className="flex absolute left-0 top-0 w-[1470px] h-[923px] overflow-clip"></div>'
if(!overlay.includes(slot))throw new Error("Missing Run 04 Shot slot")
const title="Revenue grew 39%"
const notes='data-node-label="Notes" className="flex w-[800px] h-12 items-center rounded-[10px] [background-color:var(--paper-gray-100)] px-4"'
if(!editor.includes(title)||!editor.includes(notes))throw new Error("Missing design correction target")
const correctedEditor=editor.replace(title,"Enterprise drove growth").replace(notes,notes.replace("--paper-gray-100","--paper-gray-200"))
const jsx=overlay.replace(slot,slot.replace("</div>",`${correctedEditor}</div>`))
const candidates=[...jsx.matchAll(/className="([^"]*)"/g)].flatMap(match=>match[1].split(/\s+/))
const compiled=await compile('@import "tailwindcss";',{base:process.cwd(),onDependency:()=>{}})
const html=jsx.replaceAll("className=","class=").replaceAll("strokeWidth=","stroke-width=").replaceAll("strokeLinecap=","stroke-linecap=").replaceAll("strokeLinejoin=","stroke-linejoin=")
let tokens="--ad-font:Geist;--ad-ink:#222222;--ad-surface:#ffffff;--ad-brand:#4D94FB;--ad-brand-strong:#2D6FCD;--paper-button-top:#93B8EF;--paper-blue-link:#2D6FCD;--deck-navy:#0F2433;--deck-mist:#A9C4D2;--deck-teal:#1D6B8F;"
for(const [key,value] of Object.entries({50:"F5F5F2",100:"F5F5F2",200:"EAEAE7",300:"D7D7D6",400:"A8A8A6",500:"909090",600:"666666",700:"444444",900:"222222",950:"111111"}))tokens+=`--paper-gray-${key}:#${value};`
let fonts=""
for(const weight of [400,600])fonts+=`@font-face{font-family:Geist;font-weight:${weight};src:url(data:font/woff2;base64,${(await readFile(`packages/ui/fonts/geist-latin-${weight}.woff2`)).toString("base64")})}`
const content=`<style>${compiled.build(candidates)} ${fonts} :root{${tokens}}body{margin:0}</style>${html}`
const browser=await chromium.launch({headless:true})
let image
try{
 const page=await browser.newPage({viewport:{width:1470,height:923},deviceScaleFactor:1,locale:"en-US",timezoneId:"UTC",colorScheme:"light",reducedMotion:"reduce"})
 await page.setContent(content)
 await page.evaluate(async()=>{await Promise.all([document.fonts.load("400 14px Geist"),document.fonts.load("600 14px Geist")]);await document.fonts.ready})
 image=await sharp(await page.screenshot({animations:"disabled",caret:"hide"})).resize(1248,784,{fit:"fill"}).png().toBuffer()
}finally{await browser.close()}
const digest=value=>createHash("sha256").update(value).digest("hex")
const provenance={kind:"design-source-composite",generator:generatorPath,generatorSha256:digest(generator),postprocessor:postprocessorPath,postprocessorSha256:digest(postprocessor),copy:copyPath,copySha256:digest(copy),editor:"ed1.jsx",overlay:"ed54.jsx",corrections:["selected thumbnail title: Enterprise drove growth","speaker notes background: paper-gray-200"],sourceSize:[1470,923],outputSize:[1248,784],sha256:digest(image)}
await writeFile("apps/site/public/design-product-exhibit.png",image)
await writeFile("apps/site/public/design-product-exhibit.json",JSON.stringify(provenance,null,2)+"\n")
