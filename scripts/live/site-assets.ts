export type PageAssets = { built: string[]; platform: string[]; unhashed: string[] }

const platformHosts = new Set(["static.cloudflareinsights.com"])
const contentHashed = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/

export function classifyPageAssets(urls: readonly string[], pageOrigin: string): PageAssets {
  const result: PageAssets = { built: [], platform: [], unhashed: [] }
  for (const url of new Set(urls.map(value => new URL(value)))) {
    const location = `${url.origin}${url.pathname}`
    if (platformHosts.has(url.hostname) || (url.origin === pageOrigin && url.pathname.startsWith("/cdn-cgi/"))) result.platform.push(location)
    else if (contentHashed.test(url.pathname)) result.built.push(location)
    else result.unhashed.push(location)
  }
  return { built: [...new Set(result.built)], platform: [...new Set(result.platform)], unhashed: [...new Set(result.unhashed)] }
}
