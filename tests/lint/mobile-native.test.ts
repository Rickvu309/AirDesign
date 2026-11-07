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
    ["input",css,".editor input{font-size:14px}",".editor input{font-size:14px}@media (pointer: coarse){input,textarea,select{font-size:16px}}"],
    ["textarea",css,"textarea{font-size:.8rem}","textarea{font-size:16px}"],
    ["select",css,"select{font-size:12px}","select{font-size:16px}"],
    ["root","apps/site/src/site.css","html{color:red}","html{-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%}"],
    ["coarse regression",css,"@media (pointer: coarse){input{font-size:12px}}","@media (pointer: coarse){input{font-size:16px}}"],
  ])("rejects original %s and accepts correction",(_name,file,before,after)=>{
    expect(mobileNativeHits(file,before).length).toBeGreaterThan(0)
    expect(mobileNativeHits(file,after)).toEqual([])
  })
  it("excludes browser colors while retaining public metadata copy",()=>{
    expect(publicCopy('<meta name="theme-color" content="#fff"><meta name="color-scheme" content="light"><meta name="description" content="Build decks">')).toEqual(["Build decks"])
  })
  it("ignores prose font sizes and other packages",()=>{
    expect(mobileNativeHits(css,".input-label{font-size:12px}")).toEqual([])
    expect(mobileNativeHits("packages/render/style.css","input{font-size:12px}")).toEqual([])
  })
})
