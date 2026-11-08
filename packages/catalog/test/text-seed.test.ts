import {expect,it} from "vitest"
import {fixtureDeck} from "../../deck/src/fixture.ts"
import {decodeCatalogImportV3,decodeLegacyCatalogDeckV2,decodeStoredCatalogSource} from "../src/text/seed.ts"

it("decodes retained legacy catalog seeds with detached versions without fabricating paragraphs",()=>{
  const legacy=fixtureDeck(1),text=legacy.slides[0]?.elements[0]
  if(text?.kind!=="text")throw new Error("text-fixture-required")
  legacy.version=47
  text.runs=[{...text.runs[0],text:"first\nlast\n"}]
  const native=decodeLegacyCatalogDeckV2(legacy),converted=native.slides[0]?.elements[0]
  expect(native.version).toBe(0)
  expect(legacy.version).toBe(47)
  expect(converted).toMatchObject({kind:"text",body:{paragraphs:[{runs:[{kind:"text",text:"first"},{kind:"break"},{kind:"text",text:"last"},{kind:"break"}]}]}})
  if(converted?.kind!=="text")throw new Error("native-text-required")
  expect(converted.body.paragraphs).toHaveLength(1)
  expect(decodeCatalogImportV3({deck:legacy})).toEqual(native)
  expect(decodeCatalogImportV3({deckVersion:2,deck:legacy})).toEqual(native)
  expect(decodeStoredCatalogSource(legacy)).toEqual(native)
  expect(decodeStoredCatalogSource(native)).toEqual(native)
  expect(decodeStoredCatalogSource(null)).toBeNull()
})

it("keeps native and legacy import boundaries explicit and rejects unsupported or mislabeled payloads",()=>{
  const legacy=fixtureDeck(1),native=decodeLegacyCatalogDeckV2(legacy)
  expect(decodeCatalogImportV3({deckVersion:3,deck:native})).toEqual(native)
  expect(()=>decodeCatalogImportV3({deckVersion:4,deck:native})).toThrow("unsupported-catalog-import-version")
  expect(()=>decodeCatalogImportV3({deckVersion:2,deck:native})).toThrow()
  expect(()=>decodeCatalogImportV3({deckVersion:3,deck:legacy})).toThrow()
})
