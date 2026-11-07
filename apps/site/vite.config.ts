import {createBuildIdentity} from "../../scripts/live/build-identity.ts"
import {renderSiteTerms} from "../../scripts/site-terms.ts"
import {defineConfig} from "vite"
import {resolve} from "node:path"
const buildIdentity=createBuildIdentity()
export default defineConfig({plugins:[{name:"build-identity",generateBundle(){this.emitFile({type:"asset",fileName:"version.json",source:JSON.stringify(buildIdentity)})}},{name:"shipped-public-terms",transformIndexHtml:(html:string)=>renderSiteTerms(html).replaceAll("%SITE_BUILD_ID%",buildIdentity.sha).replaceAll(/href="\/studio(?=[/"?#])/g,`href="${process.env.AIRDESIGN_STUDIO_ORIGIN ?? "https://studio.airdesign.app"}/studio`)}],build:{rollupOptions:{input:{examples:resolve(import.meta.dirname,"examples/index.html"),landing:resolve(import.meta.dirname,"index.html"),pricing:resolve(import.meta.dirname,"pricing/index.html"),agents:resolve(import.meta.dirname,"agents/index.html"),claude:resolve(import.meta.dirname,"agents/claude/index.html"),codex:resolve(import.meta.dirname,"agents/codex/index.html"),status:resolve(import.meta.dirname,"status/index.html")}}}})
