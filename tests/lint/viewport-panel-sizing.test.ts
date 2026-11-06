import {readFileSync} from "node:fs"
import {expect,it} from "vitest"
import {viewportPanelSizingHits} from "../../scripts/lint/viewport-panel-sizing.ts"

it("rejects the image picker that overflowed 320 pixels and accepts its bounded box",()=>{
  const file="apps/studio/src/images/images.css",source=readFileSync(file,"utf8")
  expect(viewportPanelSizingHits(file,source.replace("box-sizing:border-box;",""))).toHaveLength(1)
  expect(viewportPanelSizingHits(file,source)).toEqual([])
})

it("rejects shrinking controls inside the scrolling image picker",()=>{
  const file="apps/studio/src/images/images.css",source=readFileSync(file,"utf8")
  expect(viewportPanelSizingHits(file,source.replace(".image-panel>*{flex-shrink:0}",""))).toMatchObject([{reason:"scrolling-image-panel-must-not-shrink-controls"}])
  expect(viewportPanelSizingHits(file,source)).toEqual([])
})
