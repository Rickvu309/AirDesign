const address = /^(https?:|mailto:)/i

export function pageAnchor(slide: string): string {
  return `print-${slide}`
}

export function linkHref(link: string, printed: ReadonlySet<string>): string | null {
  if (address.test(link)) return link
  return printed.has(link) ? `#${pageAnchor(link)}` : null
}
