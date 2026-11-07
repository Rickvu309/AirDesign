import {fixtureDeck} from "../../packages/deck/src/fixture.ts"
import {scenario} from "../agent-account/fixture.mjs"
import {OperationStore,operationId} from "../../packages/operations/src/index.ts"
import {writeSavedPptx} from "../../packages/pptx/src/export-deck.ts"
import {investorDeck} from "./investor-deck.ts"
import {localFixture} from "./fixture-environment.ts"
import {approvalRoute} from "./approval-fixture.ts"
export async function stack(){return localFixture(()=>scenario({browserEnabled:true}))}
export async function seed(stack,entry){
  stack.fixture.advance(Date.parse("2026-11-06T03:00:00Z")-stack.fixture.now())
  if(entry.seed==="signed-out")return {route:entry.route}
  const owner=await stack.fixture.signIn("ada@halden.com")
  await stack.request(owner,`/api/people/${owner.personId}/profile`,{displayName:"Ada Lovelace"})
  if(["recents","trash-with-items","deck-open","deck-limited","deck-limited-with-credits"].includes(entry.seed)){
    await stack.request(owner,"/api/templates",{id:"halden",version:1,name:"Halden",font:"Geist",background:"#ffffff",foreground:"#102633",accent:"#1e6f8c",fontRight:"installed",families:[{id:"basic",name:"Basic",master:null,layouts:["Blank"]}]},201)
    const recentTitles=["Project Atlas","Q3 Investor Update","FY26 Operating Plan","Pricing Strategy Review","Board Pack, October","Germany Market Sizing"]
    const titles=entry.seed==="trash-with-items" ? [...recentTitles.slice(0,3),"Old pitch draft","Brightwater kickoff","Scratchpad copy"] : entry.seed==="recents" ? recentTitles.filter(title=>!["S32.02","S32.03"].includes(entry.code)||title!=="Project Atlas") : ["Q3 Investor Update"]
    const created=["2026-10-30","2026-10-21","2026-09-12","2026-09-03","2026-08-28","2026-08-04"]
    for(const [index,title] of titles.entries()){
      const id=index===0&&entry.seed.startsWith("deck-") ? "designparity"+entry.code.replaceAll(".","") : "parity"+entry.code.replaceAll(".","")+index
      const deck=investorDeck(id),position=recentTitles.indexOf(title),trashed=entry.seed==="trash-with-items"&&position<0,catalogFixture=!entry.seed.startsWith("deck-")
      if(catalogFixture){
        const cover=deck.slides[0]
        for(const element of cover.elements){
          if(element.kind==="text")element.runs[0].text=title
        }
        cover.notes=title+" overview"
      }
      if(catalogFixture)stack.fixture.advance(Date.parse(created[position<0 ? index : position]+"T03:00:00Z")-stack.fixture.now())
      await stack.request(owner,"/api/decks",deck,201)
      const age=!catalogFixture ? 0 : trashed ? [2,7,21][index-3] : [0,1/12,1,7,21,30][position]
      stack.fixture.advance(Date.parse("2026-11-06T03:00:00Z")-stack.fixture.now()-age*86400000)
      await stack.request(owner,`/api/catalog/${id}/rename`,{title})
      if(catalogFixture&&position>=0&&position<3)await stack.request(owner,`/api/catalog/${id}/star`,{starred:true})
      if(trashed)await stack.request(owner,`/api/catalog/${id}/trash`,{})
    }
    stack.fixture.advance(Date.parse("2026-11-06T03:00:00Z")-stack.fixture.now())
  }
  if(entry.seed.startsWith("deck-limited")){
    const usage=stack.fixture.history.usage
    await usage.reserve(owner.personId,{id:"fill"+entry.code,actor:"user-agent",request:"Prepare the next deck",units:10000})
    await usage.reserve(owner.personId,{id:"limit"+entry.code,actor:"user-agent",request:"Prepare the next deck",units:1})
    if(entry.seed.endsWith("with-credits"))await usage.grantFixture(owner.personId,"design-parity-credit",1000,"bonus")
  }
  if(entry.seed.startsWith("usage-active")){
    const usage=stack.fixture.history.usage
    stack.fixture.advance(Date.parse("2026-10-28T03:00:00Z")-stack.fixture.now())
    const payment=await usage.checkout(owner.personId,2000)
    await stack.webhook({id:"design-parity-original-credit",payment:payment.id,cents:2000,kind:"paid"})
    stack.fixture.advance(Date.parse("2026-11-03T03:00:00Z")-stack.fixture.now())
    await usage.reserve(owner.personId,{id:"previous-weekly-work",actor:"user-agent",request:"Prepare the board update",units:10000})
    const filled=await usage.status(owner.personId)
    if(!filled.hit)throw new Error("fixture-usage-limit-missing")
    await usage.reset(owner.personId,filled.hit)
    stack.fixture.advance(Date.parse("2026-11-06T03:00:00Z")-stack.fixture.now())
    await usage.reserve(owner.personId,{id:"weekly-work",actor:"user-agent",request:"Prepare the investor update",units:6200})
    await usage.configure(owner.personId,{autoReset:true})
    if(entry.seed==="usage-active-connected"){const {client}=await stack.fixture.authorize(owner.cookie,"Claude");await client.close()}
  }
  if(entry.seed.startsWith("oauth-")){
    return {owner,route:await approvalRoute(stack.origin,stack.fixture.apiOrigin,entry.seed.slice(6))}
  }
  return {owner,route:entry.seed.startsWith("deck-") ? entry.route.replace("designparity","designparity"+entry.code.replaceAll(".","")) : entry.route}
}
export async function perform(page,step,stack,owner){
  switch(step.kind){
    case "wait-text":await page.getByText(step.text,{exact:true}).waitFor();break
    case "click":await page.getByRole(["Recents","All decks","Trash","Settings"].includes(step.name) ? "link" : "button",{name:step.name,exact:true}).first().click();break
    case "keyboard-activate":await page.getByRole(["Recents","All decks","Trash","Settings"].includes(step.name) ? "link" : "button",{name:step.name,exact:true}).first().press("Enter");break
    case "dialog-click":await page.getByRole("dialog").getByRole("button",{name:step.name,exact:true}).click();break
    case "selector-click":await page.locator(step.selector).click();break
    case "hover":await page.getByRole("button",{name:step.name,exact:true}).hover();break
    case "fill":await page.getByLabel(step.label,{exact:true}).fill(step.value);break
    case "select":await page.getByLabel(step.label,{exact:true}).selectOption(step.value);break
    case "import":{
      await page.getByRole("button",{name:"New deck",exact:true}).click()
      await page.getByRole("button",{name:"Import PowerPoint",exact:true}).click()
      const response=page.waitForResponse(response=>response.url().endsWith("/api/operations")&&response.request().method()==="POST")
      await page.getByLabel("Import PowerPoint",{exact:true}).setInputFiles({name:"Brightwater board review.pptx",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation",buffer:await writeSavedPptx(fixtureDeck(1,6),0,null,{})})
      const operation=await (await response).json()
      if(step.outcome==="failed"){
        const store=new OperationStore(stack.fixture.operationsPath,stack.fixture.now)
        try{const id=operationId(operation.id),lease=store.claim(id);if(!lease)throw new Error("import-not-queued");store.fail(id,lease.lease,"Unable to read this PowerPoint file");store.acknowledgeCleanup(id,lease.lease)}finally{store.close()}
        await page.getByRole("heading",{name:"Unable to import this file",exact:true}).waitFor()
      }else await page.getByRole("heading",{name:"Importing PowerPoint",exact:true}).waitFor()
      break
    }
    case "agent":{
      const deck=page.url().split("/deck/")[1]
      if(!await page.getByLabel("Message Aira",{exact:true}).isVisible())await page.getByRole("button",{name:"Agent",exact:true}).click()
      if(step.outcome==="remote"){
        const {client}=await stack.fixture.authorize(owner.cookie,"Claude"),current=await stack.request(owner,`/api/decks/${deck}`),title=current.deck.slides[0].elements.find(element=>element.id==="s0e0")
        const response=await client.callTool({name:"apply_changes",arguments:{deckId:deck,base:current.seq,requestId:"design-parity-remote",changes:[{kind:"set",target:"s0e0",value:{...title,runs:[{text:"Q3 Investor Update",font:"Geist",size:40,bold:true,color:"#111827"}]}}]}})
        if(response.isError)throw new Error("remote-fixture-write-failed")
        await page.getByText("Your agent updated",{exact:false}).waitFor()
      }else{
        if(step.outcome==="long-message"){
          await page.getByLabel("Message Aira",{exact:true}).fill("Make this chart tell the story faster. Lead with the Q3 number, then show the trend across all five quarters. Keep our Halden colors and label each bar with its value. Add one takeaway line under the title, revenue grew 39% year over year, and cut the source note down to a single line so the slide breathes.")
          break
        }
        if(step.outcome==="limited"){
          await page.getByLabel("Message Aira",{exact:true}).fill("Make an 8-slide investor update from my notes. Calm, data first, our Halden brand.")
          await page.getByRole("button",{name:"Send",exact:true}).click()
          await page.locator('.aira-run-status[data-kind="limited"]').waitFor()
          await page.getByText("Your weekly usage is used up. Changes so far stay. You can keep editing manually.",{exact:true}).waitFor()
          break
        }
        const source=await stack.stream(owner,deck),hold=stack.hold(step.outcome==="failed")
        stack.parityFinish=async()=>{hold.release.resolve()}
        await page.getByLabel("Message Aira",{exact:true}).fill("Make an 8-slide investor update from my notes. Calm, data first, our Halden brand.")
        await page.getByRole("button",{name:"Send",exact:true}).click()
        await page.locator('.aira-run-status[data-kind="working"]').waitFor()
        if(step.outcome!=="working"){
          await Promise.race([hold.entered.promise,page.locator('.aira-run-status:not([data-kind="working"])').waitFor().then(()=>{throw new Error("agent-ended-before-change")})])
          hold.release.resolve()
          await stack.until(source,value=>value.run?.kind===step.outcome)
          await page.locator(`.aira-run-status[data-kind="${step.outcome}"]`).waitFor()
        }else await Promise.race([hold.entered.promise,page.locator('.aira-run-status:not([data-kind="working"])').waitFor().then(()=>{throw new Error("agent-ended-before-change")})])
      }
      break
    }
    case "export-failed":{
      const response=page.waitForResponse(response=>response.url().includes("/exports")&&response.request().method()==="POST")
      await page.getByRole("button",{name:"Create export",exact:true}).click()
      const job=await (await response).json(),lease=await stack.fixture.history.exports.claim()
      if(!lease||lease.id!==job.id)throw new Error("export-not-queued")
      await stack.fixture.history.exports.fail(lease.id,lease.lease,"Unable to create this export")
      await page.getByText("Export failed:",{exact:false}).waitFor()
      break
    }
    case "offline":await page.context().setOffline(true);await page.locator('.studio-editor[data-sync-state="offline"]').waitFor();break
    case "pay":{
      await page.getByText("Waiting for your $25.00 payment…",{exact:true}).waitFor()
      const payment=await page.evaluate(()=>sessionStorage.getItem("airdesign-payment"))
      await stack.webhook({id:"design-parity-paid",payment,cents:2500,kind:"paid"})
      await page.getByText("Payment received. Credits added.",{exact:true}).waitFor();break
    }
    case "expire-payment":{
      await page.getByText("Waiting for your $25.00 payment…",{exact:true}).waitFor()
      stack.fixture.advance(86400000)
      const payment=await page.evaluate(()=>sessionStorage.getItem("airdesign-payment"))
      await stack.request(owner,`/api/billing/payments/${payment}`)
      await page.getByText("This payment expired. Your balance is unchanged. Add credits to start again.",{exact:true}).waitFor();break
    }
    default:throw new Error("unknown-interaction")
  }
}
