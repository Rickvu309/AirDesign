import {expect,it} from "vitest"
import {classifyPageAssets} from "../../scripts/live/site-assets.ts"

const beacon="https://static.cloudflareinsights.com/beacon.min.js/vce701823e78c4301a35b7e07294d87301792088814092"

it("records the Cloudflare Web Analytics beacon a GitHub runner sees instead of failing the build hash rule",()=>{
  expect(classifyPageAssets(["https://airdesign.app/assets/site-C38uNxrm.css",beacon])).toEqual({
    built:["https://airdesign.app/assets/site-C38uNxrm.css"],
    platform:[beacon],
    unhashed:[],
  })
})

it("names every other unhashed script, including Cloudflare paths the runner probe never showed",()=>{
  expect(classifyPageAssets([
    "https://airdesign.app/assets/site.css",
    "https://airdesign.app/cdn-cgi/challenge-platform/scripts/jsd/main.js",
    "https://static.cloudflareinsights.com/other.js",
    "https://cdn.example.com/lib.js",
  ]).unhashed).toEqual([
    "https://airdesign.app/assets/site.css",
    "https://airdesign.app/cdn-cgi/challenge-platform/scripts/jsd/main.js",
    "https://static.cloudflareinsights.com/other.js",
    "https://cdn.example.com/lib.js",
  ])
})
