import assert from "node:assert/strict"
import {scenario,save,head,toolValue} from "./fixture.mjs"
const s=await scenario({browserEnabled:true}),a=`p08-review-${process.pid}`,b=`p08-review-tab-${process.pid}`,facts={head,screens:[],focus:[],semantics:[]}
const evaluate=async(session,code)=>JSON.parse(await s.browser(session,"eval","-b",Buffer.from(code).toString("base64")))
const wait=async(session,code)=>s.browser(session,"wait","--fn",code)
async function capture(name,session=a){await s.capture(session,name);facts.screens.push({name,widths:[1440,320]})}
async function focus(session,selector){await s.browser(session,"focus",selector);return evaluate(session,"document.activeElement.id || document.activeElement.textContent")}
async function assertFocus(session,before,state){const after=await evaluate(session,"document.activeElement.id || document.activeElement.textContent");assert.equal(after,before);facts.focus.push({state,before,after})}
async function submit(text,session=a){await wait(session,'Boolean(document.querySelector("#aira-prompt:not(:disabled)"))');await s.browser(session,"fill","#aira-prompt",text);await s.click(session,await evaluate(session,'document.querySelector(".aira-run-status")?.textContent.startsWith("Working") ? "Steer" : "Send"'))}
async function terminal(owner,id,kind){const source=await s.stream(owner,id),current=await s.request(owner,`/api/aira?deck=${id}`);return current.run?.kind===kind ? current : s.until(source,value=>value.run?.kind===kind)}
try{
  const owner=await s.fixture.signIn("p08-review@example.com"),id="p08_review"
  await s.deck(owner,id,3);await s.login(a,owner);await s.open(a,`/deck/${id}`,".studio-editor");await s.click(a,"Agent")
  await wait(a,'Boolean(document.querySelector("#aira-prompt:not(:disabled)"))')
  await s.browser(a,"select","#aira-scope","whole")
  let hold=s.hold();await submit("Clarify our next quarter priorities");await hold.entered.promise
  await wait(a,'document.querySelector(".aira-run-status")?.textContent.startsWith("Working")')
  const working=await s.request(owner,`/api/aira?deck=${id}`)
  await capture("aira-working");await wait(a,'Boolean(document.querySelector("#aira-prompt:not(:disabled)"))');let before=await focus(a,"#aira-prompt")
  s.fixture.advance(61000);const second=await s.fixture.signIn("p08-review@example.com");await s.login(b,second);await s.open(b,`/deck/${id}`,".studio-editor");await s.click(b,"Agent")
  await submit("Give the remaining slides an explicit owner",b)
  const steered=await s.request(second,`/api/aira?deck=${id}`);assert.equal(steered.run.id,working.run.id)
  await wait(a,'document.querySelector(".aira-conversation")?.textContent.includes("explicit owner") || document.querySelector("[role=log]")?.textContent.includes("explicit owner")')
  await assertFocus(a,before,"second-tab steer");await capture("aira-steer-first-tab");await capture("aira-steer-second-tab",b)
  before=await focus(a,"#aira-prompt");hold.release.resolve();await terminal(owner,id,"complete");await wait(a,'document.querySelector(".aira-run-status")?.textContent.startsWith("Done")')
  await assertFocus(a,before,"complete");await capture("aira-complete")
  await s.browser(a,"click",".editor-changes summary");await capture("changes-by-slide")
  const remote=await s.fixture.authorize(owner.cookie,"Review remote agent"),current=await s.request(owner,`/api/decks/${id}`)
  const remoteWrite=await remote.client.callTool({name:"apply_changes",arguments:{deckId:id,base:current.seq,requestId:"review_remote",changes:[{kind:"set",target:"s0e1",value:{...current.deck.slides[0].elements[1],fill:"#556677"}}]}});assert.notEqual(remoteWrite.isError,true)
  await wait(a,'document.querySelector("[role=log]")?.textContent.includes("Your agent updated")');await capture("own-agent-editing")
  hold=s.hold();await submit("Stop after the first safe change");await hold.entered.promise;await s.click(a,"Stop");hold.release.resolve();await terminal(owner,id,"stopped");await wait(a,'document.querySelector(".aira-run-status")?.textContent.startsWith("Stopped")');await capture("aira-cancel");const stopped=await s.request(owner,`/api/aira?deck=${id}`);await s.click(a,"Resume");const resumed=await terminal(owner,id,"complete");assert.equal(resumed.run.id,stopped.run.id);await wait(a,'document.querySelector(".aira-run-status")?.textContent.startsWith("Done")');await capture("aira-stop-resumed")
  hold=s.hold(true);await submit("Keep accepted changes if this fixture fails");await hold.entered.promise;const failureFocus=await focus(a,"#aira-prompt");hold.release.resolve();await terminal(owner,id,"failed");await wait(a,'document.querySelector(".aira-run-status")?.textContent.includes("couldn’t finish")');await assertFocus(a,failureFocus,"failed")
  facts.semantics.push({state:"failed",tree:await s.browser(a,"snapshot"),status:await evaluate(a,'document.querySelector(".aira-run-status").getAttribute("role")')});await capture("aira-failed");await s.click(a,"Resume");await terminal(owner,id,"complete")
  await submit("Our operating model needs a clear story. ".repeat(125));await terminal(owner,id,"complete");await wait(a,'document.querySelector(".aira-run-status")?.textContent.startsWith("Done")');await capture("aira-long-message")
  await s.open(a,"/settings/usage",".credit-balance");await capture("settings-usage");await s.click(a,"Add credits");await capture("credits-amount")
  await s.browser(a,"network","route","**/api/billing/checkout","--abort")
  await s.click(a,"Continue to payment");await wait(a,'Boolean(document.querySelector("[role=alert]"))');facts.semantics.push({state:"payment-error",tree:await s.browser(a,"snapshot")});await capture("credits-error")
  await s.browser(a,"network","unroute","**/api/billing/checkout");await s.click(a,"Continue to payment");await wait(a,'document.querySelector(".payment-status")?.textContent.includes("Waiting")')
  const payment=(await s.request(owner,"/api/billing/checkout",{cents:2500})).payment
  await focus(a,"[data-credits-close]");const paymentFocus=await evaluate(a,'document.activeElement.id || document.activeElement.textContent');await capture("credits-waiting")
  await s.webhook({id:"review-paid",payment:payment.id,kind:"paid",cents:payment.cents});await wait(a,'document.querySelector(".payment-status")?.textContent.includes("Credits added")');await assertFocus(a,paymentFocus,"paid")
  facts.semantics.push({state:"paid",tree:await s.browser(a,"snapshot")});await capture("credits-success")
  await s.webhook({id:"review-refund",payment:payment.id,kind:"refunded",cents:payment.cents});await wait(a,'document.querySelector(".payment-status")?.textContent.includes("refunded")');await assertFocus(a,paymentFocus,"refund");await capture("credits-refund")
  await s.fixture.history.usage.reserve(owner.personId,{id:"review-exhaust",actor:"user-agent",request:"prior usage",units:(await s.request(owner,"/api/usage")).remaining})
  await s.open(a,`/deck/${id}`,".studio-editor");await s.click(a,"Agent");await submit("Continue after a person resets usage");await terminal(owner,id,"limited");await wait(a,'Boolean(document.querySelector(".aira-panel time"))');await capture("aira-usage-limit")
  facts.semantics.push({state:"usage-limit",tree:await s.browser(a,"snapshot")});await s.click(a,"Reset usage");await capture("aira-usage-reset-confirm");await s.click(a,"Cancel")
  await s.open(a,"/settings/agents",".settings-panels");await capture("settings-agents")
  await s.open(a,"/settings/account",".settings-panels");await wait(a,'Boolean([...document.querySelectorAll("button")].find(button=>button.textContent==="Delete account"&&!button.disabled))');await capture("settings-account");await s.click(a,"Delete account");await wait(a,'Boolean(document.querySelector("[role=dialog]"))');await capture("account-deletion")
  facts.semantics.push({state:"deletion-confirmation",tree:await s.browser(a,"snapshot")});await s.click(a,"Delete account permanently");await wait(a,'Boolean(document.querySelector("input[type=email]"))');assert.equal((await s.request(second,"/api/account",undefined,401)).status,"signed-out")
  facts.run=working.run.id;facts.sameRunAfterSteer=steered.run.id;facts.remote=toolValue(remoteWrite);facts.duplicateActivity="covered by live lane 10 and ChatPanel DOM regression";facts.errorFixture="one rejected checkout fetch; no provider call";facts.verdict="pass"
  await save("review/receipt.json",facts);await save("review/trace.json",{head,trace:s.trace,commits:s.commits});console.log(JSON.stringify({verdict:"pass",screens:facts.screens.length,head}))
}finally{await save("review/last-attempt.json",{facts,trace:s.trace.slice(-20)});await s.close()}
