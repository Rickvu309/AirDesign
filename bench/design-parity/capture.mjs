import {clipboardSource} from "../../apps/studio/src/editor/editor-model.ts"
import {createHash} from "node:crypto"
import {fixtureDeck} from "../../packages/deck/src/fixture.ts"
import {scenario} from "../agent-account/fixture.mjs"
import {OperationStore,operationId} from "../../packages/operations/src/index.ts"
import {writeSavedPptx} from "../../packages/pptx/src/export-deck.ts"
import {investorDeck} from "./investor-deck.ts"
import {localFixture} from "./fixture-environment.ts"
export async function stack(){return localFixture(()=>scenario({browserEnabled:true}))}
export async function seed(stack,entry){
  stack.fixture.advance(Date.parse("2026-11-06T03:00:00Z")-stack.fixture.now())
  if(entry.seed==="signed-out")return {route:entry.route}
  const owner=await stack.fixture.signIn("ada@halden.com")
  await stack.request(owner,`/api/people/${owner.personId}/profile`,{displayName:"Ada Lovelace"})
  if(["recents","trash-with-items","deck-open","deck-limited","deck-limited-with-credits"].includes(entry.seed)){
    await stack.request(owner,"/api/templates",{id:"halden",version:1,name:"Halden",font:"Geist",background:"#ffffff",foreground:"#102633",accent:"#1e6f8c",fontRight:"installed",families:[{id:"basic",name:"Basic",master:null,layouts:["Blank"]}]},201)
    const titles=entry.seed==="recents" ? ["Project Atlas","Q3 Investor Update","FY26 Operating Plan","Pricing Strategy Review","Board Pack, October","Germany Market Sizing"] : entry.seed==="trash-with-items" ? ["Old pitch draft","Brightwater kickoff","Scratchpad copy"] : ["Q3 Investor Update"]
    for(const [index,title] of titles.entries()){
      const id=index===0&&entry.seed.startsWith("deck-") ? "designparity"+entry.code.replaceAll(".","") : "parity"+entry.code.replaceAll(".","")+index
      const deck=investorDeck(id)
      const age=entry.seed==="trash-with-items" ? [2,7,21][index] : [0,1/12,1,7,21,30][index]
      stack.fixture.advance(Date.parse("2026-11-06T03:00:00Z")-stack.fixture.now()-age*86400000)
      await stack.request(owner,"/api/decks",deck,201)
      await stack.request(owner,`/api/catalog/${id}/rename`,{title})
      if(entry.seed==="trash-with-items")await stack.request(owner,`/api/catalog/${id}/trash`,{})
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
    if(entry.seed==="usage-active-connected")await stack.fixture.authorize(owner.cookie,"Claude")
  }
  if(entry.seed.startsWith("oauth-")){
    const name=entry.seed.slice(6),registered=await stack.request(null,"/oauth/register",{client_name:name,redirect_uris:["http://127.0.0.1:49199/callback"],token_endpoint_auth_method:"none"},201)
    const params=new URLSearchParams({client_id:registered.client_id,redirect_uri:registered.redirect_uris[0],code_challenge:createHash("sha256").update("design-parity-verifier".repeat(3)).digest("base64url"),code_challenge_method:"S256",resource:stack.origin+"/mcp",scope:"decks",response_type:"code",state:"design-parity"})
    const response=await fetch(stack.fixture.apiOrigin+"/oauth/authorize?"+params,{redirect:"manual"})
    return {owner,route:new URL(response.headers.get("location"),stack.origin).pathname+new URL(response.headers.get("location"),stack.origin).search}
  }
  return {owner,route:entry.seed.startsWith("deck-") ? entry.route.replace("designparity","designparity"+entry.code.replaceAll(".","")) : entry.route}
}
export async function perform(page,step,stack,owner){
  switch(step.kind){
    case "assert":await page.locator(step.selector).waitFor({state:"visible"});break
    case "hold":{
      const button=page.getByRole("button",{name:step.name,exact:true});await button.hover();await page.mouse.down();await page.locator(".contextual-insertion-slot").waitFor();await page.mouse.up();break
    }
    case "paste-slides":{
      const deck=fixtureDeck(1,step.count)
      for(const [index,slide] of deck.slides.entries()){
        const title=slide.elements.find(element=>element.kind==="text");title.runs=[{text:index===0 ? "Market share by region" : "Churn is down to 4%",font:"Geist",size:48,bold:true,color:"#1f1f1f"}];title.box={x:70.4,y:70.4,width:819.2,height:60}
        const base={source:{kind:"created"},support:{kind:"native"},theme:null,placeholder:null,overlap:null,kind:"shape",geometry:"rectangle"}
        slide.elements=[title,...(index===0 ? [46,34,58,26].map((height,n)=>({...base,id:`pastebar${index}n${n}`,box:{x:70.4+n*116.8,y:470.4-height*3.2,width:83.2,height:height*3.2},fill:"#8a8a8a"})) : [180,150,164].map((width,n)=>({...base,id:`pasteline${index}n${n}`,box:{x:70.4,y:168+n*41.6,width:width*3.2,height:16},fill:"#d7d7d6"})))]
      }
      const source=clipboardSource(deck,deck.slides.map(slide=>slide.id));await page.context().grantPermissions(["clipboard-read","clipboard-write"]);await page.evaluate(source=>navigator.clipboard.writeText(source),source);await page.locator(".studio-editor").focus();await page.keyboard.press("Control+V");await page.getByText(`${step.count} slides pasted`,{exact:true}).waitFor();break
    }
    case "wait-text":await page.getByText(step.text,{exact:true}).waitFor();break
    case "click":await page.getByRole("button",{name:step.name,exact:true}).first().click();break
    case "keyboard-activate":await page.getByRole("button",{name:step.name,exact:true}).first().press("Enter");break
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
          await page.locator('.editor-slide:not([hidden]) [data-kind="group"]').click({position:{x:4,y:4}})
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
        const source=await stack.stream(owner,deck),hold=stack.hold(step.outcome==="failed",step.outcome==="working" ? "before" : "after")
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
