import { inflateSync } from "node:zlib"

export type PdfPage = {
  readonly box: readonly number[]
  readonly content: string
  readonly links: readonly string[]
}

function objectText(text: string, id: string): string {
  const start = text.search(new RegExp(`(^|\\n)${id} 0 obj\\b`))
  return start < 0 ? "" : text.slice(start, text.indexOf("endobj", start))
}

function streamOf(pdf: Buffer, text: string, id: string): string {
  const start = text.search(new RegExp(`(^|\\n)${id} 0 obj\\b`))
  const head = text.indexOf("stream", start)
  const from = head + "stream".length
  const body = pdf.subarray(text[from] === "\r" ? from + 2 : from + 1, text.indexOf("endstream", from))
  return (/\/FlateDecode/.test(text.slice(start, head)) ? inflateSync(body) : body).toString("latin1")
}

function drawn(pdf: Buffer, text: string, owner: string, content: string, depth: number): string {
  if (depth > 8) return content
  const forms = [...content.matchAll(/\/([\w.]+)\s+Do\b/g)].flatMap(([, name]) => {
    const id = new RegExp(`\\/${name ?? ""}\\s+(\\d+)\\s+0\\s+R`).exec(owner)?.[1]
    if (id === undefined) return []
    const form = objectText(text, id)
    return /\/Subtype\s*\/Form/.test(form) ? [drawn(pdf, text, form, streamOf(pdf, text, id), depth + 1)] : []
  })
  return [content, ...forms].join("\n")
}

function linksOf(text: string, page: string): readonly string[] {
  const annots = /\/Annots\s*\[([^\]]*)\]/.exec(page)?.[1] ?? ""
  return [...annots.matchAll(/(\d+)\s+0\s+R/g)].flatMap(([, id]) => {
    const annot = objectText(text, id ?? "")
    if (!/\/Subtype\s*\/Link/.test(annot)) return []
    const uri = /\/URI\s*\(([^)]*)\)/.exec(annot)?.[1]
    if (uri !== undefined) return [uri]
    return /\/Dest\b|\/S\s*\/GoTo\b/.test(annot) ? ["page"] : []
  })
}

export function pdfPages(pdf: Buffer): readonly PdfPage[] {
  const text = pdf.toString("latin1")
  const pages = [...text.matchAll(/(\d+) 0 obj\s*<<\s*\/Type\s*\/Page\b(?!s)/g)]
  return pages.map(([, id]) => {
    const page = objectText(text, id ?? "")
    const box = (/\/MediaBox\s*\[([^\]]*)\]/.exec(page)?.[1] ?? "").trim().split(/\s+/).map(Number)
    const contents = /\/Contents\s+(\d+)\s+0\s+R/.exec(page)?.[1] ?? ""
    return { box, content: drawn(pdf, text, page, streamOf(pdf, text, contents), 0), links: linksOf(text, page) }
  })
}
