import path from "node:path"
import {execFileSync} from "node:child_process"
import {writeFile} from "node:fs/promises"
import {reviewFixture} from "./review-fixture.mjs"
const review=await reviewFixture(),head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),file=path.join(review.directory,"connection-and-failure.webm")
try{
  await review.browser("set","viewport","1440","1000");await review.browser("open",review.consent);await review.browser("wait","--text","wants to use AirDesign")
  await review.browser("record","start",file)
  await review.click("Allow");await review.browser("wait","--text","Ready to return to your agent");await review.click("Having trouble returning?");await review.browser("wait","--text","Unable to return to your agent")
  await review.browser("open",review.origin+"/settings/agents");await review.browser("wait","--text","Connected agents");await review.click("Disconnect");await review.browser("wait","--text","Your decks and saved work stay here.")
  const snapshot=await review.browser("snapshot","-i"),buttons=snapshot.split("\n").filter(line=>line.includes('button "Disconnect"'));await review.browser("click","@"+buttons.at(-1).match(/ref=(e\d+)/)[1]);await review.browser("wait","--text","Disconnected")
  await review.browser("open",review.expired);await review.browser("wait","--text","Approval has expired")
  await review.browser("open",review.origin+"/settings/usage");await review.browser("wait","--text","Weekly usage")
  await review.browser("record","stop");await writeFile(path.join(review.directory,"video.json"),JSON.stringify({head,file,script:"bench/metered-mcp/review-video.mjs",states:["consent","approved","failed-return","revoke-confirmation","disconnected","expired","usage-limit"]},null,2));process.stdout.write(file+"\n")
}finally{await review.close()}
