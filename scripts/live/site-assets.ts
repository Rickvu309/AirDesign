export type PageAssets = { built: string[]; platform: string[]; unhashed: string[] }

const contentHashed = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/

export function classifyPageAssets(urls: readonly string[]): PageAssets {
  const result: PageAssets = { built: [], platform: [], unhashed: [] }
  for (const url of new Set(urls.map(value => new URL(value)))) {
    const location = `${url.origin}${url.pathname}`
    if (url.hostname === "static.cloudflareinsights.com" && url.pathname.startsWith("/beacon.min.js")) result.platform.push(location)
    else if (contentHashed.test(url.pathname)) result.built.push(location)
    else result.unhashed.push(location)
  }
  return { built: [...new Set(result.built)], platform: [...new Set(result.platform)], unhashed: [...new Set(result.unhashed)] }
}
