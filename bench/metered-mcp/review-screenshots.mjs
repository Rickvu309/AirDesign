import {execFileSync} from "node:child_process"
import {writeFile} from "node:fs/promises"
import path from "node:path"
import assert from "node:assert/strict"
import {reviewFixture} from "./review-fixture.mjs"
const review=await reviewFixture(),receipts=[],head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
try{
  for(const width of [1440,320]){
    await review.browser("set","viewport",String(width),"1000")
    async function shot(name,text){await review.browser("wait","--text",text);const file=path.join(review.directory,`${name}-${width}.png`);await review.browser("screenshot",file,"--full");const layout=await review.browser("eval","JSON.stringify({width:innerWidth,documentWidth:document.documentElement.scrollWidth,text:document.body.innerText})");const measured=JSON.parse(JSON.parse(layout));assert.equal(measured.width,width);assert.equal(measured.documentWidth,width,`${name} overflows at ${width}`);receipts.push({head,name,width,file,layout});assert.ok(layout.includes(text));process.stdout.write(`${name}-${width} ${file}\n`)}
    await review.browser("open",await review.pending());await shot("consent","wants to use AirDesign")
    await review.click("Allow");await review.browser("wait","--text","Ready to return to your agent");await review.click("Having trouble returning?");await shot("failed-return","Unable to return to your agent")
    await review.browser("open",review.origin+"/settings/agents");await shot("connected","Connected agents")
    await review.click("Disconnect");await shot("revoke","Your decks and saved work stay here.")
    await review.click("Cancel")
    await review.browser("open",review.expired);await shot("expired","Approval has expired")
    await review.browser("open",review.origin+"/settings/usage");await shot("usage-limit","Weekly usage")
  }
  await writeFile(path.join(review.directory,"screenshots.json"),JSON.stringify({head,receipts},null,2))
}finally{await review.close()}
