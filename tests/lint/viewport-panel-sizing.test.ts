import {readFileSync} from "node:fs"
import {expect,it} from "vitest"
import {viewportPanelSizingHits} from "../../scripts/lint/viewport-panel-sizing.ts"

it("rejects the image picker that overflowed 320 pixels and accepts its bounded box",()=>{
  const file="apps/studio/src/images/images.css",source=readFileSync(file,"utf8")
  expect(viewportPanelSizingHits(file,source.replace("box-sizing:border-box;",""))).toHaveLength(1)
  expect(viewportPanelSizingHits(file,source)).toEqual([])
})
