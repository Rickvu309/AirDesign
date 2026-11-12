import postcss, { type AtRule, type Container, type Rule } from "postcss"

type Meta = { readonly name: string; readonly content: string; readonly media: string | undefined }

function attributeOf(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
    .exec(tag)
    ?.slice(1)
    .find((part) => part !== undefined)
}

function metas(html: string): Meta[] {
  return [...html.matchAll(/<meta\s[^>]*>/gi)].flatMap((match) => {
    const name = attributeOf(match[0], "name")
    if (name === undefined) return []
    return [
      {
        name: name.toLowerCase(),
        content: attributeOf(match[0], "content") ?? "",
        media: attributeOf(match[0], "media"),
      },
    ]
  })
}

function squash(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase()
}

export function viewportFindings(html: string): string[] {
  const viewport = metas(html).find((meta) => meta.name === "viewport")
  if (viewport === undefined) return ["no viewport meta"]
  const content = squash(viewport.content)
  const findings: string[] = []
  if (!content.includes("width=device-width")) findings.push("the viewport does not say width=device-width")
  if (!content.includes("initial-scale=1")) findings.push("the viewport does not say initial-scale=1")
  if (/user-scalable=(no|0)/.test(content)) findings.push("the viewport turns zoom off with user-scalable")
  if (content.includes("maximum-scale")) findings.push("the viewport caps zoom with maximum-scale")
  return findings
}

export function viewportReachFindings(html: string): string[] {
  const viewport = metas(html).find((meta) => meta.name === "viewport")
  const content = squash(viewport?.content ?? "")
  const findings: string[] = []
  if (!content.includes("viewport-fit=cover")) findings.push("the viewport does not say viewport-fit=cover")
  if (!content.includes("interactive-widget=resizes-content"))
    findings.push("the viewport does not say interactive-widget=resizes-content")
  return findings
}

export function themeColorFindings(html: string): string[] {
  const colors = metas(html).filter((meta) => meta.name === "theme-color")
  if (colors.length === 0) return ["no theme-color meta"]
  const findings: string[] = []
  if (colors.some((meta) => meta.media === undefined)) findings.push("a theme-color has no prefers-color-scheme media")
  for (const scheme of ["light", "dark"]) {
    if (!colors.some((meta) => squash(meta.media ?? "") === `(prefers-color-scheme:${scheme})`))
      findings.push(`no theme-color for the ${scheme} scheme`)
  }
  return findings
}

export function themeColorFor(html: string, scheme: "light" | "dark"): string | undefined {
  return metas(html).find(
    (meta) => meta.name === "theme-color" && squash(meta.media ?? "") === `(prefers-color-scheme:${scheme})`,
  )?.content
}

function behindHoverQuery(node: Container | undefined): boolean {
  for (let parent = node; parent !== undefined; parent = parent.parent as Container | undefined) {
    if (parent.type !== "atrule") continue
    const query = squash((parent as AtRule).params)
    if ((parent as AtRule).name === "media" && query.includes("(hover:hover)") && query.includes("(pointer:fine)"))
      return true
  }
  return false
}

export function hoverFindings(css: string): string[] {
  const findings: string[] = []
  postcss.parse(css).walkRules((rule: Rule) => {
    if (rule.selector.includes(":hover") && !behindHoverQuery(rule.parent)) {
      findings.push(`${rule.selector} is not inside @media (hover: hover) and (pointer: fine)`)
    }
  })
  return findings
}

export function viewportHeightFindings(html: string, css: string): string[] {
  return /\b100l?vh\b/.test(`${html}\n${css}`)
    ? ["100vh or 100lvh is used; a hero takes 100svh and an app shell 100dvh"]
    : []
}

export function safeAreaFindings(html: string, css: string): string[] {
  const usesInsets = /env\(\s*safe-area-inset/.test(`${html}\n${css}`)
  const covers = squash(metas(html).find((meta) => meta.name === "viewport")?.content ?? "").includes(
    "viewport-fit=cover",
  )
  return usesInsets && !covers
    ? ["env(safe-area-inset-*) is used and the viewport does not say viewport-fit=cover"]
    : []
}
