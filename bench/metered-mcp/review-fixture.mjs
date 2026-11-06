import {createServer as createNetServer} from "node:net"
import {execFile} from "node:child_process"
import {promisify} from "node:util"
import {mkdir,writeFile} from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import assert from "node:assert/strict"
import {createServer} from "vite"
import {mcpFixture} from "../../apps/server/test/mcp/fixture.ts"
const execute=promisify(execFile)
export async function reviewFixture(){
  const probe=createNetServer();await new Promise(resolve=>probe.listen(0,"127.0.0.1",resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve))
  const origin=`http://127.0.0.1:${port}`,fixture=await mcpFixture({publicOrigin:origin}),previous=process.env.AIRDESIGN_API_ORIGIN
  process.env.AIRDESIGN_API_ORIGIN=fixture.apiOrigin
  const studio=path.resolve("apps/studio"),packages=path.resolve("packages")
  const vite=await createServer({root:studio,configFile:path.join(studio,"vite.config.ts"),resolve:{alias:{"@airdesign/ui":path.join(packages,"ui/src/index.ts"),"@airdesign/access/client":path.join(packages,"access/src/client/index.ts")}},server:{host:"127.0.0.1",port,strictPort:true}});await vite.listen()
  const directory=path.join(process.env.P07_EVIDENCE ?? path.join(os.homedir(),"tmp/airdesign-autopilot/P07"),"review"),session=`p07-review-${process.pid}`,transcript=[]
  await mkdir(directory,{recursive:true})
  const browser=async(...args)=>{const {stdout,stderr}=await execute("agent-browser",["--session",session,...args],{maxBuffer:2*1024*1024,timeout:45000});transcript.push({args:args[0]==="cookies"?["cookies","set","redacted"]:args,stdout,stderr});return stdout}
  try{
    const owner=await fixture.signIn("review@example.com")
    const registration=await (await fixture.json("/oauth/register",{client_name:"Local reference agent",redirect_uris:["http://127.0.0.1:49199/callback"],token_endpoint_auth_method:"none"})).json()
    const params=new URLSearchParams({client_id:registration.client_id,redirect_uri:registration.redirect_uris[0],response_type:"code",code_challenge:"a".repeat(43),code_challenge_method:"S256",resource:origin+"/mcp",scope:"decks",state:"review-state"})
    async function pending(){const response=await fetch(fixture.apiOrigin+"/oauth/authorize?"+params,{redirect:"manual"});assert.equal(response.status,302);return response.headers.get("location")}
    const expired=await pending();fixture.advance(25*3600000)
    await fixture.authorize(owner.cookie,"Local reference agent")
    await fixture.history.usage.reserve(owner.personId,{id:"review-limit",units:10000,actor:"user-agent",request:"Make the executive summary more concise"})
    const consent=await pending()
    for(const pair of owner.cookie.split("; ")){const index=pair.indexOf("=");await browser("cookies","set",pair.slice(0,index),pair.slice(index+1),"--url",origin)}
    async function click(label){const snapshot=await browser("snapshot","-i"),line=snapshot.split("\n").find(line=>line.includes(`button "${label}"`));assert.ok(line,`${label} absent: ${snapshot}`);const ref=line.match(/ref=(e\d+)/)?.[1];assert.ok(ref);await browser("click",`@${ref}`)}
    return {fixture,origin,directory,browser,click,consent,expired,async pending(){return pending()},async close(){try{await browser("close")}finally{await writeFile(path.join(directory,`${session}.json`),JSON.stringify(transcript,null,2));await vite.close();await fixture.close();if(previous===undefined)delete process.env.AIRDESIGN_API_ORIGIN;else process.env.AIRDESIGN_API_ORIGIN=previous}}}
  }catch(error){await vite.close();await fixture.close();throw error}
}
