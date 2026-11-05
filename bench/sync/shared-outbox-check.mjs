import assert from "node:assert/strict"
import { chromium, expect } from "playwright/test"
import { execFileSync } from "node:child_process"
import { writeFile } from "node:fs/promises"
import { localStack } from "./local-stack.mjs"
import { browserClient, queue } from "./scenarios.mjs"
import { fixtureDeck } from "../../packages/deck/src/fixture.ts"
const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
const stack=await localStack(),browser=await chromium.launch()
let a
try {
 a=await browserClient(browser,stack.origin,"shared-outbox@example.com")
 const deck="sharedoutbox"
 assert.equal((await a.context.request.post(stack.origin+"/api/decks",{headers:{origin:stack.origin},data:{...fixtureDeck(2),id:deck}})).status(),201)
 await a.open(deck)
 const page=await a.context.newPage()
 await page.goto(stack.origin+"/sync-fixture?deck="+deck)
 await page.locator('main[data-sync-state="saved"]').waitFor()
 const b={...a,page,notes:page.getByLabel("Speaker notes",{exact:true})}
 await a.offline();await page.evaluate(()=>window.dispatchEvent(new Event("offline")))
 await a.notes.fill("tab a pending")
 await expect.poll(async()=>(await queue(a,deck)).length).toBe(1)
 const aId=(await queue(a,deck))[0].command.id
 await b.notes.fill("tab b pending")
 await expect.poll(async()=>(await queue(a,deck)).length).toBe(2)
 const ids=(await queue(a,deck)).map(item=>item.command.id)
 assert(ids.includes(aId))
 await a.page.reload();await page.reload()
 await expect(a.notes).toHaveValue("tab b pending")
 await expect(b.notes).toHaveValue("tab b pending")
 a.control.offline=false
 await a.page.getByRole("button",{name:"Reconnect",exact:true}).click()
 await page.getByRole("button",{name:"Reconnect",exact:true}).click()
 await a.saved();await page.locator('main[data-sync-state="saved"]').waitFor()
 await expect.poll(async()=>(await queue(a,deck)).length).toBe(0)
 const events=await (await a.context.request.get(stack.origin+"/api/decks/"+deck+"/events?after=0")).json()
 assert.deepEqual(events.events.map(event=>event.command.id).sort(),ids.sort())
 const deliveries=a.control.outgoing.filter(command=>ids.includes(command.id)).map(command=>command.id)
 assert.deepEqual(deliveries.sort(),ids.sort())
 await a.offline()
 await a.notes.fill("offline undo redo")
 await a.page.getByRole("button",{name:"Undo",exact:true}).click()
 await expect(a.notes).toHaveValue("tab b pending")
 await a.page.getByRole("button",{name:"Redo",exact:true}).click()
 await expect(a.notes).toHaveValue("offline undo redo")
 await expect.poll(async()=>(await queue(a,deck)).length).toBe(3)
 const offlineHistory=await queue(a,deck)
 assert.deepEqual(offlineHistory.map(item=>item.command.kind),["patch","undo","redo"])
 await a.page.reload();await expect(a.notes).toHaveValue("offline undo redo")
 await a.reconnect();await expect(b.notes).toHaveValue("offline undo redo")
 assert.equal((await queue(a,deck)).length,0)
 const snapshot=await (await a.context.request.get(stack.origin+"/api/decks/"+deck)).json()
 assert.equal(snapshot.seq,5)
 const result={head,verdict:"pass",sameContext:true,pages:2,ids,deliveries,events:events.events,offlineHistory,finalSequence:snapshot.seq}
 if(process.env.P04_FIX_OUTPUT)await writeFile(process.env.P04_FIX_OUTPUT,JSON.stringify(result,null,2))
 process.stdout.write(JSON.stringify({head,verdict:"pass",sameContext:true,pages:2})+"\n")
}finally{await a?.context.close();await browser.close();await stack.close()}
