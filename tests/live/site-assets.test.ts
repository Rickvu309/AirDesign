import {expect,it} from "vitest"
import {classifyPageAssets} from "../../scripts/live/site-assets.ts"

const origin="https://airdesign.app"

it("keeps Cloudflare-injected scripts out of the build hash rule but records them",()=>{
  const assets=classifyPageAssets([
    `${origin}/assets/site-C38uNxrm.css`,
    `${origin}/assets/geist-latin-400-B40WzpMT.woff2`,
    `${origin}/cdn-cgi/challenge-platform/scripts/jsd/main.js`,
    "https://static.cloudflareinsights.com/beacon.min.js",
  ],origin)
  expect(assets).toEqual({
    built:[`${origin}/assets/site-C38uNxrm.css`,`${origin}/assets/geist-latin-400-B40WzpMT.woff2`],
    platform:[`${origin}/cdn-cgi/challenge-platform/scripts/jsd/main.js`,"https://static.cloudflareinsights.com/beacon.min.js"],
    unhashed:[],
  })
})

it("names every unhashed or foreign asset so a failure says which file broke",()=>{
  expect(classifyPageAssets([`${origin}/assets/site.css`,`${origin}/studio-capture.js`,"https://cdn.example.com/lib.js"],origin).unhashed)
    .toEqual([`${origin}/assets/site.css`,`${origin}/studio-capture.js`,"https://cdn.example.com/lib.js"])
})
