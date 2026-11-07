import type {Page} from "playwright"
import {readFile} from "node:fs/promises"
import {z} from "zod"
import type {Scenario} from "./registry.ts"

async function visible(page:Page,text:string){
  const candidates=[page.getByText(text,{exact:true}),page.getByRole("link",{name:text,exact:true}),page.getByRole("button",{name:text,exact:true})]
  for(const locator of candidates)for(const element of await locator.all())if(await element.isVisible())return
  throw new Error(`required-visible-copy:${text}`)
}
export async function assertScenarioCopy(page:Page,keys:string[]){
  const copy=z.record(z.string(),z.unknown()).parse(JSON.parse(await readFile(new URL("../../docs/design/v0.1/copy-kit.json",import.meta.url),"utf8")))
  for(const key of keys){
    const text=z.string().parse(copy[key])
    await visible(page,text)
  }
}
export async function assertScenarioDOM(page:Page,entry:Scenario){
  await assertScenarioCopy(page,entry.assertions.copyKeys)
  for(const text of entry.assertions.texts)await visible(page,text)
  for(const control of entry.assertions.controls){
    const locator=page.getByRole(control.role,{name:control.name,exact:true}).first()
    if(!await locator.isVisible())throw new Error(`required-control:${control.role}:${control.name}`)
  }
}
export async function probeScenarioInteraction(page:Page,entry:Scenario){
  const probe=entry.assertions.probe
  switch(probe.kind){
    case "fill":{
      const previousFocus=await page.$(":focus")
      const field=page.getByLabel(probe.label,{exact:true}),original=await field.inputValue()
      await field.fill(probe.value)
      if(await field.inputValue()!==probe.value)throw new Error("input-probe-failed")
      await field.fill(original)
      await field.blur()
      await previousFocus?.focus()
      break
    }
    case "dialog":{
      await page.getByRole("button",{name:probe.open,exact:true}).first().click()
      const dialog=page.getByRole("dialog",{name:probe.title,exact:true})
      await dialog.waitFor({state:"visible"})
      await dialog.getByRole("button",{name:probe.close,exact:true}).click()
      await dialog.waitFor({state:"hidden"})
      break
    }
    case "view":{
      const single=page.getByRole("button",{name:"Single slide view",exact:true}),grid=page.getByRole("button",{name:"Grid view",exact:true})
      await page.getByRole("button",{name:"Slide 3",exact:true}).click()
      await single.click()
      if(await single.getAttribute("aria-pressed")!=="true"||await grid.getAttribute("aria-pressed")!=="false")throw new Error("view-probe-failed")
      await grid.click()
      if(await grid.getAttribute("aria-pressed")!=="true")throw new Error("view-probe-restore-failed")
      break
    }
    case "navigate":{
      const original=page.url()
      await page.getByRole("link",{name:probe.name,exact:true}).first().click()
      await page.waitForURL(url=>url.pathname+url.hash===probe.path)
      await page.goto(original)
      break
    }
    case "approval":
      await page.getByRole("button",{name:"Cancel",exact:true}).click()
      await page.getByRole("heading",{name:"Connection cancelled",exact:true}).waitFor()
      break
    case "expired":
      await page.getByRole("button",{name:"Send a new link",exact:true}).click()
      await page.getByRole("heading",{name:"Sign in",exact:true}).waitFor()
      await page.reload()
      await page.getByRole("heading",{name:"This link has expired",exact:true}).waitFor()
      break
    default:{const exhaustive:never=probe;throw new Error(String(exhaustive))}
  }
}
