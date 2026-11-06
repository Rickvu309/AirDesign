import assert from "node:assert/strict"
import {createServer} from "node:net"
import {readFile,mkdir,writeFile} from "node:fs/promises"
import {existsSync} from "node:fs"
import path from "node:path"
import os from "node:os"
import {preview} from "vite"
import {mcpFixture} from "../../apps/server/test/mcp/fixture.ts"
import {execute,head} from "../agent-account/fixture.mjs"
const probe=createServer();await new Promise(resolve=>probe.listen(0,"127.0.0.1",resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve))
const origin=`http://127.0.0.1:${port}`,fixture=await mcpFixture({publicOrigin:origin}),root=process.env.P09_EVIDENCE??path.join(os.homedir(),"tmp/airdesign-autopilot/P09"),directory=path.join(root,"lane-1"),session=`p09-discovery-${process.pid}`,trace=[]
await mkdir(directory,{recursive:true})
const server=await preview({root:"apps/site",configFile:"apps/site/vite.config.ts",plugins:[{name:"local-studio-mount",configurePreviewServer(server){server.middlewares.use(async(req,res,next)=>{const url=new URL(req.url,origin),asset=url.pathname.startsWith("/assets/")&&!existsSync(path.join("apps/site/dist",url.pathname));if(!asset&&!/^\/(studio|deck|auth)(\/|$)/.test(url.pathname))return next();const file=asset?path.join("apps/studio/dist",url.pathname):"apps/studio/dist/index.html";try{const bytes=await readFile(file);res.setHeader("content-type",asset&&file.endsWith(".js")?"application/javascript":asset&&file.endsWith(".css")?"text/css":"text/html");res.end(bytes)}catch(error){next(error)}})}}],preview:{host:"127.0.0.1",port,strictPort:true,proxy:{"/api":fixture.apiOrigin,"/ws":{target:fixture.apiOrigin,ws:true}}}})
async function browser(...args){const result=await execute("agent-browser",["--session",session,...args],{timeout:60000,maxBuffer:1000000});trace.push({args,stdout:result.stdout,stderr:result.stderr});return result.stdout}
async function wait(expression){await browser("wait","--fn",expression)}
try{
 await browser("set","viewport","1440","960");await browser("open",origin);await browser("click",".actions a[href='/studio?start=new-deck']");await wait("Boolean(document.querySelector('input[type=email]'))");await browser("screenshot",path.join(directory,"sign-in.png"))
 const email="discovery-first-deck@example.com";await browser("fill","input[type=email]",email);await browser("click","[data-screen=signin] button");await wait("Boolean(document.querySelector('[autocomplete=one-time-code]'))")
 const inbox=await (await fixture.json(`/api/dev/inbox?to=${encodeURIComponent(email)}`)).json();assert.ok(inbox.messages.at(-1)?.code);for(const [index,digit]of [...inbox.messages.at(-1).code].entries())await browser("fill",`.ad-code-box:nth-child(${index+1})`,digit);await wait("Boolean(document.querySelector('.home-empty'))")
 await browser("click",".home-empty .home-actions button:first-child");await wait("Boolean(document.querySelector('.studio-editor'))");await browser("screenshot",path.join(directory,"first-deck.png"));const state=JSON.parse(await browser("eval","({path:location.pathname,text:document.body.innerText})"));assert.ok(state.path.startsWith("/deck/"));assert.ok(!/\b(Share|Present)\b/.test(state.text))
 await browser("open",origin+"/studio?start=import");await wait("Boolean(document.querySelector('.import-card input[type=file]'))");await browser("screenshot",path.join(directory,"import-intent.png"))
 await writeFile(path.join(directory,"discovery.json"),JSON.stringify({head,status:"pass",scope:"actual same-origin local site mount, email-code sign-in, first deck, signed-in import intent",firstDeck:state.path,deployment:"not deployed; public HTTPS remains X05",trace},null,2));console.log(JSON.stringify({head,discovery:"pass",firstDeck:state.path}))
}finally{await browser("close").catch(()=>undefined);await new Promise(resolve=>server.httpServer.close(resolve));await fixture.close()}
