import {mkdir,readFile,writeFile,copyFile,readdir} from "node:fs/promises"
import {createHash} from "node:crypto"
import {execFileSync} from "node:child_process"
import os from "node:os"
import path from "node:path"
const root=process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),registry=JSON.parse(await readFile("docs/planning/v0.1/delivery/contract-index.json","utf8")),head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()
const actions={
 X01:"Provide licensed Windows and Mac PowerPoint with build numbers and licensed fonts. Open every safe P03R imported/native/applied-template deck on each OS, edit native text/table/chart, save/reopen without repair; capture full slides and masters/fonts, compare pixel and line counts. Never open hostile fixtures in Office.",
 X02:"Provide a screen-reader operator with NVDA/Windows and VoiceOver/Mac. Record actual speech and focus transcripts for sign-in errors, manual edit, offline/reconnect, import/export, Aira stop/resume/failure, usage and account deletion, payment waiting/error/refund states. Record OS/browser/AT versions.",
 X03:"Authorize a paid budget and provide credentials through the secret mechanism for pinned Claude plus a second model, and the pinned Claude Agent SDK. Run all 40 tool tasks three times per model with raw tools, cost, time-to-first-commit and baseline comparison; run the 48 quality tasks three times. No authorization here.",
 X04:"Provide two independent presentation designers and one target reader. Vet and freeze baseline deck hashes, complete 120 independently randomized pair ratings before discussion, compute ordinal Krippendorff alpha and decisive judge agreement, adjudicate disputes, then run both blinded judge orders for all release samples.",
 X05:"Explicitly authorize a public HTTPS test endpoint or tunnel and provide the actual Claude Code, Cursor, ChatGPT, Claude and Codex client versions. Complete each published guide including OAuth/revoke, native capture visibility, pagination and stale recovery; retain redacted transcripts. No endpoint is started by this kit.",
 X06:"Provide an eligible supported-provider sandbox account and approved sandbox credentials. Verify minimum payment, eligibility/country/FX, signed webhook duplicates/cancel/paid/refund/chargeback, reconciliation and production scheduling readiness without activation or live charges."
}
const predicates={X01:["Windows and Mac reopen without repair","native text/table/chart editable","master/font inventory correct","pixel fraction <=0.001 per slide and <=0.01 per item","line-count delta zero"],X02:["actual AT speech transcripts across all required flows","focus/error/announcement assertions"],X03:["40 tasks x 3 trials x 2 pinned models","completion >=90%","authorization and atomicity 100%","zero baseline regressions","actual SDK-bound Aira smoke","raw first-change distributions and costs"],X04:["120 pairs x 3 independent raters","96 candidates median overall >=4","accepted craft medians >=4 and zero hard defects","ordinal alpha >=0.60","decisive judge agreement >=80% or human decisions","48 tasks x 3 samples in both orders","44/48 and 7/8 per family, lower95 >=0.50"],X05:["explicit endpoint authorization","each claimed client connected and revoked","native image visible","pagination complete","stale recovery correct"],X06:["sandbox provider signatures and race results","eligible country and FX documented","reconciliation exact","scheduling readiness documented","no live charges or activation"]}
for(const [id,gate]of Object.entries(registry.externalGates)){
 const directory=path.join(root,"external",id);await mkdir(directory,{recursive:true})
 await writeFile(path.join(directory,"receipt.json"),JSON.stringify({head,status:"blocked",gate:id,description:gate.description,operatorAction:actions[id],expectedPredicates:predicates[id],results:path.join(directory,"results"),passed:[]},null,2))
 await writeFile(path.join(directory,"checklist.md"),`# ${id} operator kit

${actions[id]}

${predicates[id].map(value=>`- [ ] ${value}`).join("\n")}

Save raw outputs, versions, authorization receipt and artifact hashes under results/. Do not edit blocked receipt until the operator has reviewed actual evidence. Validate the inventory with: node bench/release/validate-external.mjs ${id}
`)
 await copyFile("bench/release/validate-external.mjs",path.join(directory,"validate.mjs"))
 await writeFile(path.join(directory,"fixtures.json"),JSON.stringify({quality:"bench/quality/release-set.json",tools:"bench/quality/tool-tasks.json",referencePack:path.join(os.homedir(),"tmp/airdesign-autopilot/P03/P03R"),priorEvidence:"P01-P08 manifests",protocol:"docs/release/judge-protocol.md"},null,2))
}
const directory=path.join(root,"calibration");await mkdir(directory,{recursive:true})
await writeFile(path.join(directory,"ratings.csv"),"pair,family,rater,role,side,overall,hierarchy,composition,typography_color,visual_communication,deck_consistency,hard_defects,takeaway,preference\n"+Array.from({length:120},(_,i)=>["designer-1","designer-2","target-reader"].map((r,j)=>`${i+1},${registry.externalGates.X04?['dense-content','data-chart','editorial','non-Latin','image-led','technical-diagram'][i%6]:''},${r},${j<2?'designer':'reader'},${(i+j)%2?'B':'A'},,,,,,,,,`).join("\n")).join("\n")+"\n")
const source=await readFile("bench/quality/release-set.json");await writeFile(path.join(directory,"freeze.json"),JSON.stringify({head,status:"blocked-X04",releaseSetSha256:createHash("sha256").update(source).digest("hex"),baselineHashes:[],ratingCount:360,seed:20261106,blindMapping:"operator holds mapping; never send to judge"},null,2))
console.log(JSON.stringify({head,gates:6,status:"blocked",root}))
