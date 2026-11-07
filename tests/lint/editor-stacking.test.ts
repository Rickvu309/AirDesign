import {readFileSync} from "node:fs"
import {expect,it} from "vitest"
import {editorStackingHits} from "../../scripts/lint/editor-stacking.ts"
it("rejects the original equal stacking contexts and accepts the raised deck toolbar",()=>{
  const file="apps/studio/src/editor/editor.css",source=readFileSync(file,"utf8")
  expect(editorStackingHits(file,source.replace(".editor-bar { z-index:31;",".editor-bar { "))).toHaveLength(1)
  expect(editorStackingHits(file,source)).toEqual([])
})
