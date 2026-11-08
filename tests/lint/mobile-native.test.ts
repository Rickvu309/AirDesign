import {describe,it,expect} from "vitest"
import {publicCopy} from "../../packages/lint/src/release-claims.ts"
import {mobileNativeHits} from "../../scripts/lint/mobile-native.ts"

const css="apps/studio/src/editor/workspace.css"
describe("mobile native source rules",()=>{
  it.each([
    ["zoom", "apps/studio/index.html", '<meta name="viewport" content="user-scalable=no, maximum-scale=1">', '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#fff"><meta name="color-scheme" content="light">'],
    ["theme", "apps/site/index.html", '<meta name="viewport" content="width=device-width">', '<meta name="theme-color" content="#fff"><meta name="color-scheme" content="light">'],
    ["dark scheme", "apps/studio/index.html", '<meta name="theme-color" content="#fff"><meta name="color-scheme" content="light dark">', '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fff"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000"><meta name="color-scheme" content="light dark">'],
    ["hover",css,"@media (hover: hover){button:hover{color:red}}","@media (hover: hover) and (pointer: fine){button:hover{color:red}}"],
    ["nested hover",css,"@media (width > 20px){button:hover{color:red}}","@media (width > 20px){@media (hover: hover) and (pointer: fine){button:hover{color:red}}}"],
    ["viewport",css,".app{height:100vh}",".app{height:100dvh}"],
    ["root","apps/site/src/site.css","html{color:red}","html{-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%}"],
  ])("rejects original %s and accepts correction",(_name,file,before,after)=>{
    expect(mobileNativeHits(file,before).length).toBeGreaterThan(0)
    expect(mobileNativeHits(file,after)).toEqual([])
  })
  it("accepts landing touch rules without duplicating the root highlight",()=>{
    const source="html{-webkit-text-size-adjust:100%}@media(pointer:coarse){a,summary{touch-action:manipulation;-webkit-tap-highlight-color:transparent}}"
    expect(mobileNativeHits("/workspace/apps/site/src/site.css",source)).toEqual([])
    expect(mobileNativeHits("apps/site/src/site.css",source.replace("transparent","auto")).some(hit=>hit.reason==="mobile-root-needs-transparent-tap-highlight")).toBe(true)
    expect(mobileNativeHits("apps/studio/src/mobile.css",source).some(hit=>hit.reason==="mobile-root-needs-transparent-tap-highlight")).toBe(true)
  })
  it("excludes browser colors while retaining public metadata copy",()=>{
    expect(publicCopy('<meta name="theme-color" content="#fff"><meta name="color-scheme" content="light"><meta name="description" content="Build decks">')).toEqual(["Build decks"])
  })
  it("ignores prose font sizes and other packages",()=>{
    expect(mobileNativeHits(css,".input-label{font-size:12px}")).toEqual([])
    expect(mobileNativeHits("packages/render/style.css","input{font-size:12px}")).toEqual([])
  })
})

describe("cascade independent mobile checks",()=>{
  it.each([
   ["OR list", "@media (hover:hover), (pointer:fine){button:hover{color:red}}"],
   ["OR expression", "@media (hover:hover) or (pointer:fine){button:hover{color:red}}"],
   ["negated media", "@media not all and (hover:hover) and (pointer:fine){button:hover{color:red}}"],
   ["nested ampersand", ".card{&:hover{color:red}}"],
   ["nested descendant", ".card{button:hover{color:red}}"],
  ])("rejects %s",(_name,source)=>{
   expect(mobileNativeHits(css,source).some(hit=>hit.reason==="mobile-hover-needs-fine-hover-media")).toBe(true)
  })
  it.each([
   "@media(hover:hover)and(pointer:fine){button:hover{color:red}}",
   "@MEDIA (HOVER : HOVER) AND (POINTER : FINE){button:hover{color:red}}",
   "@media ( hover : hover )\nAND\t( pointer : fine ){button:hover{color:red}}",
   "@media (hover:hover) and (pointer:fine){.card{&:hover{color:red}}}",
   ".card{@media (hover:hover) and (pointer:fine){&:hover{color:red}}}",
   ".app{height:100vh;height:100dvh}",
   ".app{height:100vh;height:100svh}",
   ".editor input{font-size:14px}@media (pointer:coarse){input{font-size:16px}}",
  ])("accepts safe source %s",source=>expect(mobileNativeHits(css,source)).toEqual([]))
  it.each([
   ".app{height:100vh;color:red;height:100dvh}",
   ".app{height:100vh;min-height:100dvh}",
   ".app{height:100vh}.other{height:100dvh}",
  ])("rejects an unrelated viewport fallback %s",source=>{
   expect(mobileNativeHits(css,source).some(hit=>hit.reason==="mobile-height-use-dvh-or-svh")).toBe(true)
  })
 })
