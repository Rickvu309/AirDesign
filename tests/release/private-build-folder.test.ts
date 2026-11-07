import {it,expect} from "vitest"
import {existsSync} from "node:fs"
import {withPrivateBuildFolder} from "./private-build-folder.ts"
it("removes the private build folder when the build fails",async()=>{
 let allocated=""
 await expect(withPrivateBuildFolder(outDir=>{allocated=outDir;throw new Error("build-failed")},async()=>"unused")).rejects.toThrow("build-failed")
 expect(allocated).not.toBe("")
 expect(existsSync(allocated)).toBe(false)
})
it("removes the private build folder when using the build fails",async()=>{
 let allocated=""
 await expect(withPrivateBuildFolder(outDir=>{allocated=outDir},async()=>{throw new Error("preview-failed")})).rejects.toThrow("preview-failed")
 expect(existsSync(allocated)).toBe(false)
})
it("keeps the private build folder while it is used and removes it after",async()=>{
 let allocated=""
 expect(await withPrivateBuildFolder(outDir=>{allocated=outDir},async outDir=>existsSync(outDir))).toBe(true)
 expect(existsSync(allocated)).toBe(false)
})
