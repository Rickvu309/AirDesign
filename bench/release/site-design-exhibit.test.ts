import {readFile} from "node:fs/promises"
import {chromium} from "playwright"
import sharp from "sharp"
import {expect,it} from "vitest"

it("renders deck check values in the landing typeface while retaining monospace labels",async()=>{
 const css=await readFile("apps/site/src/site.css","utf8")
 const browser=await chromium.launch({headless:true})
 try{
  const page=await browser.newPage()
  await page.setContent(`<style>${css}:root{--font-sans:Arial}</style><div class="deck-checks"><span>SLIDES</span><b>12</b></div><div class="price"><ul><li><svg></svg></li></ul></div>`)
  const styles=await page.locator(".deck-checks").evaluate(element=>{
   const label=getComputedStyle(element.querySelector("span")!)
   const value=getComputedStyle(element.querySelector("b")!)
   return {labelFont:label.fontFamily,valueFont:value.fontFamily,size:value.fontSize,weight:value.fontWeight}
  })
  expect(styles.labelFont).toBe("monospace")
  expect(styles.valueFont).not.toBe("monospace")
  expect(styles.size).toBe("13px")
  expect(styles.weight).toBe("500")
  expect(await page.locator(".price svg").evaluate(element=>getComputedStyle(element).strokeWidth)).toBe("1.75px")
 }finally{await browser.close()}
})

it("shows a gray usage ring with a blue sector in the product exhibit",async()=>{
 const {data,info}=await sharp("apps/site/public/design-product-exhibit.png").removeAlpha().raw().toBuffer({resolveWithObject:true})
 const pixel=(x:number,y:number)=>[...data.subarray((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+3)]
 const gray=pixel(1197,66)
 const blue=pixel(1206,66)
 expect(Math.abs(gray[2]!-gray[0]!)).toBeLessThan(15)
 expect(blue[2]!-blue[0]!).toBeGreaterThan(30)
})
