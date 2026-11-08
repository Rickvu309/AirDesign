import {readFile} from "node:fs/promises"
import {expect,it} from "vitest"
import {fixtureContentHash,readRegistry,validateIdentity} from "./registry.ts"
import {textRoleSizes} from "./dom-assertions.ts"

it("enters the check-inbox state through the painted canonical email action",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S22.01")!
  expect(entry.status).toBe("reachable")
  if(entry.status!=="reachable")throw new Error("missing-check-inbox-journey")
  expect(entry.steps).toContainEqual({kind:"click",name:"Continue with email"})
})

it("keeps every committed fixture receipt current",async()=>{
  const lock=JSON.parse(await readFile("bench/design-parity/scenario-lock.json","utf8"))
  expect(lock).toHaveLength(52)
  for(const entry of lock)expect(entry.fixtureContentHash,entry.code).toBe(fixtureContentHash())
})

it("keeps every committed scenario identity aligned with its registry",async()=>{
  await validateIdentity(await readRegistry())
})

it("derives every traced role size and weight from its design generator classes",async()=>{
  const source=await readFile("docs/design/v0.1/source/gen-editor.mjs","utf8")
  const citations={"landing-hero":["H Line"],"pricing-title":["Pricing Title"],"page-title":["Import Title"],"consent-title":["Connect Title"],"access-error-title":["Err Title"],"dialog-title":["Alert Title"],"module-title":["Brand Name"],body:["Toast Text","Nav Link"],helper:["Card State"]}
  for(const role of Object.keys(textRoleSizes))expect(citations).toHaveProperty(role)
  for(const [role,labels] of Object.entries(citations)){
    const tokens=labels.map(label=>{
      const call=source.slice(label==="H Line" ? source.indexOf("('H Line', 'Clarity is the edge.'") : source.indexOf(`('${label}',`))
      const classes=call.match(/^\('[^']+',\s*(?:'[^']*'|"[^"]*"|[^,]+),\s*([`'"])(.*?)\1/)?.[2]
      expect(classes,label).toBeDefined()
      const size=classes!.split(/\s/).includes("text-xl") ? 20 : Number(classes!.match(/text-\[(\d+)px\]/)![1])
      const weight=classes!.includes("font-semibold") ? 600 : classes!.includes("font-medium") ? 500 : 400
      return {size,weight}
    })
    expect(Reflect.get(textRoleSizes,role),role).toEqual([Math.min(...tokens.map(token=>token.size)),Math.max(...tokens.map(token=>token.size)),tokens[0]!.weight])
    expect(new Set(tokens.map(token=>token.weight)).size).toBe(1)
  }
})

it("assigns the expired-link heading its generator-specific error title role",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S29.01")!
  expect(entry.assertions.structure.textRoles).toContainEqual({selector:"h1",role:"access-error-title",color:"ink",minimumContrast:4.5})
})

it("opens the intended New deck menu through its accessible summary",async()=>{
  const entry=(await readRegistry()).find(entry=>entry.code==="S32.01")!
  expect(entry.status).toBe("reachable")
  if(entry.status!=="reachable")throw new Error("missing-new-deck-journey")
  expect(entry.steps).toEqual([{kind:"selector-click",selector:'summary[aria-label="New deck"]'}])
})

it("rejects citing the import page title for the consent heading",async()=>{
 const source=await readFile("docs/design/v0.1/source/gen-editor.mjs","utf8")
 const call=source.slice(source.indexOf("('Import Title',"))
 const classes=call.match(/^\('[^']+',\s*(?:'[^']*'|"[^"]*"|[^,]+),\s*([`'"])(.*?)\1/)?.[2]
 expect(classes).toBeDefined()
 const size=Number(classes!.match(/text-\[(\d+)px\]/)![1])
 const weight=classes!.includes("font-semibold") ? 600 : classes!.includes("font-medium") ? 500 : 400
 expect(()=>expect([size,size,weight]).toEqual(textRoleSizes["consent-title"])).toThrow()
})
