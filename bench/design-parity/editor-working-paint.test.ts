import {readFile} from "node:fs/promises"
import {chromium} from "playwright"
import {expect,it} from "vitest"

it("paints the actual working glow in both views and a dot only on the working filmstrip slide",async()=>{
  const css=await readFile("apps/studio/src/editor/editor.css","utf8"),tokens=await readFile("packages/ui/src/tokens/tokens.css","utf8"),browser=await chromium.launch()
  try{
    const page=await browser.newPage({viewport:{width:1470,height:923}})
    await page.setContent(`<style>${tokens}${css}</style><div class="studio-editor" data-view="single"><article class="editor-slide" data-run-state="working"><div class="slide-preview" style="inline-size:800px;block-size:450px;background:white"></div></article><nav class="editor-filmstrip"><details open><button data-run-state="working"><span>2</span><div class="slide-preview"></div></button><button data-run-state="queued"><span>3</span><div class="slide-preview"></div></button></details></nav></div>`)
    for(const view of ["single","grid"]){
      await page.locator('.studio-editor').evaluate((element,view)=>element.setAttribute("data-view",view),view)
      const glow=await page.locator('article>.slide-preview').evaluate(element=>({shadow:getComputedStyle(element).boxShadow,border:getComputedStyle(element,"::before").backgroundImage}))
      expect(glow.shadow).toContain("28px")
      expect(glow.shadow).toContain("56px")
      expect(glow.border).toContain("linear-gradient")
    }
    const dot=await page.locator('button[data-run-state="working"]>span').evaluate(element=>{const style=getComputedStyle(element,"::after");return {content:style.content,width:style.width,height:style.height,color:style.backgroundColor}})
    expect(dot).toMatchObject({content:'""',width:"6px",height:"6px",color:"rgb(77, 148, 251)"})
    expect(await page.locator('button[data-run-state="queued"]>span').evaluate(element=>getComputedStyle(element,"::after").content)).toBe("none")
    await page.locator('article').evaluate(element=>element.removeAttribute("data-run-state"))
    expect(await page.locator('article>.slide-preview').evaluate(element=>getComputedStyle(element,"::before").content)).toBe("none")
  }finally{await browser.close()}
})
