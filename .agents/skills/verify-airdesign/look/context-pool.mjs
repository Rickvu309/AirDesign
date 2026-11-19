const visited = new WeakMap()

async function open(browser, options) {
  const context = await browser.newContext(options)
  const origins = new Set()
  context.on("request", (request) => {
    const { protocol, origin } = new URL(request.url())
    if (protocol === "http:" || protocol === "https:") origins.add(origin)
  })
  visited.set(context, origins)
  return context
}

async function clear(context) {
  for (const page of context.pages()) await page.close()
  await context.unrouteAll({ behavior: "ignoreErrors" })
  await context.clearCookies()
  await context.clearPermissions()
  await context.setOffline(false)
  const origins = visited.get(context)
  const blank = await context.newPage()
  const session = await context.newCDPSession(blank)
  for (const origin of origins) await session.send("Storage.clearDataForOrigin", { origin, storageTypes: "all" })
  await blank.close()
  origins.clear()
}

export function contextPool(browser, options) {
  const idle = []
  return {
    take: async () => idle.pop() ?? open(browser, options),
    async give(context) {
      try {
        await clear(context)
      } catch {
        await context.close()
        return
      }
      idle.push(context)
    },
    close: async () => {
      await Promise.all(idle.splice(0).map((context) => context.close()))
    },
  }
}
