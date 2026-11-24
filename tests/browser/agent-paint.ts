import type { Page } from "@playwright/test"
import { agentArrivalMark, agentRenderMark } from "./renderer-thread"

export async function watchAgentPaint(page: Page, target: string, since: string, once: string): Promise<void> {
  await page.evaluate(
    ({ target, since, once, arrivalMark, renderMark }) => {
      const selector = `[data-slide-box] [data-node="${CSS.escape(target)}"]`
      const original = document.querySelector(selector)
      if (original === null) throw new Error("no canvas node for the agent edit")
      const styleBefore = original.getAttribute("style")
      const json = Response.prototype.json
      const painted = new Promise<void>((resolve) => {
        Response.prototype.json = async function (this: Response): Promise<unknown> {
          const body: unknown = await json.call(this)
          if (new URL(this.url, location.href).pathname !== since || typeof body !== "object" || body === null)
            return body
          if (!("edits" in body) || !Array.isArray(body.edits)) return body
          const found = body.edits.some(
            (edit: unknown) => typeof edit === "object" && edit !== null && "once" in edit && edit.once === once,
          )
          if (!found) return body

          Response.prototype.json = json
          console.timeStamp(arrivalMark)
          const watch = new MutationObserver(() => {
            const element = document.querySelector(selector)
            if (element === null || element.getAttribute("style") === styleBefore) return
            watch.disconnect()
            console.timeStamp(renderMark)
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          })
          watch.observe(document.querySelector("[data-slide-box]")!, {
            subtree: true,
            childList: true,
            attributes: true,
          })
          return body
        }
      })
      Object.assign(window, { agentPainted: painted })
    },
    { target, since, once, arrivalMark: agentArrivalMark, renderMark: agentRenderMark },
  )
}

export async function waitForAgentPaint(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (!("agentPainted" in window) || !(window.agentPainted instanceof Promise))
      throw new Error("agent paint watcher was not installed")
    await window.agentPainted
  })
}
