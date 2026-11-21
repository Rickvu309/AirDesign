export function replyRoutes(page, ...origins) {
  const holds = new Set()

  async function intercept({ path }, handler, search) {
    const match = (url) =>
      origins.includes(url.origin) && url.pathname === path && (search === undefined || url.search === search)
    await page.route(match, handler)
    return () => page.unroute(match, handler)
  }

  return {
    async releaseHeldReplies() {
      await Promise.all([...holds].map((release) => release()))
    },

    async holdReply(entry, { afterServer = false, forMs, search } = {}) {
      const held = Promise.withResolvers()
      const received = Promise.withResolvers()
      let timer
      let closed = false
      function open() {
        clearTimeout(timer)
        held.resolve()
        received.resolve()
      }
      function close() {
        closed = true
        open()
      }
      const restore = await intercept(
        entry,
        async (route) => {
          if (forMs !== undefined) timer ??= setTimeout(open, forMs)
          const response = afterServer ? await route.fetch() : undefined
          received.resolve(response)
          await held.promise
          if (closed) return
          if (response === undefined) await route.fallback()
          else
            await route.fulfill({ response }).catch((error) => {
              if (!error.message.endsWith("Route is already handled!")) throw error
            })
        },
        search,
      )
      async function release() {
        if (!holds.delete(release)) return
        try {
          if (!closed) await restore()
        } finally {
          page.off("close", close)
          open()
        }
      }
      holds.add(release)
      page.once("close", close)
      return { received: received.promise, release }
    },

    async dropReply(entry) {
      const dropped = Promise.withResolvers()
      let forwarded = false
      const restore = await intercept(entry, async (route) => {
        if (forwarded) return route.abort("connectionfailed")
        forwarded = true
        const request = route.request()
        const response = await route.fetch()
        await route.abort("connectionfailed")
        dropped.resolve({ request, response })
      })
      return { dropped: dropped.promise, restore }
    },

    failReply(entry, failure) {
      return intercept(entry, (route) =>
        failure === undefined ? route.abort("connectionfailed") : route.fulfill(failure),
      )
    },
  }
}
