import assert from "node:assert/strict"
import {mkdir,writeFile,mkdtemp,rm} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import {chromium} from "playwright"
import {scenario} from "../agent-account/fixture.mjs"

const out=process.env.STUDIO_PRIVACY_EVIDENCE ?? path.join(os.homedir(),"tmp/airdesign-polish/shell/privacy-hotfix-browser")
await mkdir(out,{recursive:true})
process.env.NODE_ENV="test"
const local=await scenario({browserEnabled:true}),checks=[]
let context
const profile=await mkdtemp(path.join(os.homedir(),"tmp/studio-privacy-"))
try{
  const owner=await local.fixture.signIn("ada@halden.com")
  await local.request(owner,`/api/people/${owner.personId}/profile`,{displayName:"Ada Lovelace"})
  for(const touch of [false,true]){
    local.fixture.advance(120000)
    context=await chromium.launchPersistentContext(path.join(profile,String(touch)),{channel:"chromium",headless:true,ignoreDefaultArgs:["--disable-back-forward-cache"],viewport:touch ? {width:390,height:844} : {width:1440,height:960},isMobile:touch,hasTouch:touch})
    await context.addInitScript(()=>{window.addEventListener("pageshow",event=>{window.restoredFromCache=event.persisted})})
    const page=await context.newPage()
    await page.goto(local.origin)
    await page.locator('input[type="email"]').fill("ada@halden.com")
    await page.getByRole("button",{name:"Continue",exact:true}).click()
    await page.locator('input[inputmode="numeric"]').first().waitFor()
    const inbox=await (await local.fixture.json("/api/dev/inbox?to=ada%40halden.com")).json()
    for(const [i,digit] of [...inbox.messages.at(-1).code].entries())await page.locator('input[inputmode="numeric"]').nth(i).fill(digit)
    await page.getByRole("heading",{name:"No decks yet",exact:true}).waitFor()
    await page.goto(local.origin+"/settings/usage")
    await page.getByRole("progressbar",{name:"Weekly usage",exact:true}).waitFor()
    await page.getByRole("heading",{name:"Settings",exact:true}).waitFor()
    await page.goto(local.origin+"/")
    await page.getByRole("button",{name:"Sign out",exact:true}).click()
    await page.getByRole("dialog").getByRole("button",{name:"Sign out",exact:true}).click()
    await page.locator('[data-screen="signin"]').waitFor()
    await page.goBack({waitUntil:"commit"})
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    await page.screenshot({path:path.join(out,`back-immediate-${touch ? "touch-390" : "1440"}.png`)})
    const privateVisible=await page.getByRole("heading",{name:"Settings",exact:true}).isVisible() || await page.getByText("Ada Lovelace",{exact:true}).isVisible() || await page.locator(".ad-shell").isVisible()
    const session=await (await context.request.get(local.origin+"/api/session")).json()
    const restored=await page.evaluate(()=>window.restoredFromCache)
    checks.push({touch,session:session.status,restored,privateVisible,reasons:await page.evaluate(()=>performance.getEntriesByType("navigation")[0]?.notRestoredReasons?.toJSON())})
    await writeFile(path.join(out,"report.json"),JSON.stringify(checks,null,2))
    assert.equal(session.status,"signed-out")
    assert.equal(restored,true,"Chromium must restore the Settings history entry from its back/forward cache")
    if(privateVisible){await context.close();continue}
    await page.locator('[data-screen="signin"]').waitFor()
    assert.equal(await page.getByText("Ada Lovelace",{exact:true}).count(),0)
    await page.screenshot({path:path.join(out,`back-signed-out-${touch ? "touch-390" : "1440"}.png`)})
    await context.close()
  }
  assert.ok(checks.every(check=>!check.privateVisible),"Back must not paint private Settings at either viewport")
  console.log(JSON.stringify({passed:true,checks}))
}finally{await context?.close();await local.close();await rm(profile,{recursive:true,force:true})}
