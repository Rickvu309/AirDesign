import {expect,it,vi} from "vitest"
import {downloadArtifact} from "./download-artifact.ts"

it("downloads and reports the artifact's filename rather than its format or current deck title",async()=>{
  vi.stubGlobal("fetch",async()=>new Response("export bytes",{headers:{"content-disposition":'attachment; filename="Investor update-v42.pptx"'}}))
  const create=vi.fn(()=>"blob:export"),revoke=vi.fn()
  vi.stubGlobal("URL",class extends URL{static createObjectURL=create;static revokeObjectURL=revoke})
  const downloads:string[]=[],click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(function(this:HTMLAnchorElement){downloads.push(this.download)})
  vi.useFakeTimers()
  try{
    expect(await downloadArtifact("/artifact")).toBe("Investor update-v42.pptx")
    expect(downloads).toEqual(["Investor update-v42.pptx"])
    expect(document.querySelector('a[download]')).toBeNull()
    await vi.runAllTimersAsync();expect(revoke).toHaveBeenCalledWith("blob:export")
  }finally{click.mockRestore();vi.useRealTimers();vi.unstubAllGlobals()}
})
it("does not announce a download or create a file for failed artifact responses",async()=>{
  vi.stubGlobal("fetch",async()=>new Response("expired",{status:410}))
  const click=vi.spyOn(HTMLAnchorElement.prototype,"click")
  try{await expect(downloadArtifact("/artifact")).rejects.toThrow("Unable to download");expect(click).not.toHaveBeenCalled()}
  finally{click.mockRestore();vi.unstubAllGlobals()}
})
