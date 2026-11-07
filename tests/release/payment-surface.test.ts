import {it,expect} from "vitest"
import {chromium} from "playwright"
import {preview} from "vite"
import {execFileSync} from "node:child_process"
import path from "node:path"
import {mcpFixture} from "../../apps/server/test/mcp/fixture.ts"
it("built Studio exposes allowance and balances without unfinished payments in a normal start",async()=>{
  execFileSync("npm",["run","build","--workspace=@airdesign/studio"],{stdio:"pipe"})
  const fixture=await mcpFixture(),browser=await chromium.launch({headless:true})
  const studio=await preview({root:path.resolve("apps/studio"),configFile:path.resolve("apps/studio/vite.config.ts"),preview:{host:"127.0.0.1",port:0,proxy:{"/api":fixture.apiOrigin}}})
  try{
    const address=studio.httpServer.address();if(!address||typeof address==="string")throw new Error("missing-studio-port")
    const origin=`http://127.0.0.1:${address.port}`,owner=await fixture.signIn("release-payments@example.com"),context=await browser.newContext()
    await context.addCookies(owner.cookie.split("; ").map(pair=>{const split=pair.indexOf("=");return {name:pair.slice(0,split),value:pair.slice(split+1),url:origin}}))
    const page=await context.newPage()
    await page.goto(origin+"/settings/usage")
    await page.getByRole("heading",{name:"Weekly usage",exact:true}).waitFor()
    const add=page.getByRole("button",{name:"Add credits",exact:true})
    if(await add.count())await add.click()
    const surface=await page.locator("body").innerText()
    expect(surface).not.toMatch(/Continue to payment|Waiting for your.*payment|Local (?:payment )?fixture/i)
    expect(surface).toContain("Buying credits is not available yet.")
    expect(surface).toContain("Weekly usage")
    expect(surface).toContain("Resets Monday at 8:00 AM")
    expect(surface).toContain("$0.00")
    const checkout=await fixture.json("/api/billing/checkout",{cents:2500},owner.cookie)
    expect(checkout.status).toBe(503)
    expect((await fixture.json("/api/billing/webhook",{})).status).toBe(503)
    await page.goto(origin+"/settings/usage?payment=00000000-0000-0000-0000-000000000000")
    await page.getByRole("heading",{name:"Weekly usage",exact:true}).waitFor()
    expect(await page.locator("body").innerText()).not.toMatch(/Continue to payment|Waiting for your.*payment|Local (?:payment )?fixture/i)
  }finally{await browser.close();await new Promise<void>(resolve=>studio.httpServer.close(()=>resolve()));await fixture.close()}
},60000)
