import type { Color, ColorTransform } from "@airdesign/document"

function transformXml(transform: ColorTransform): string {
  return "val" in transform ? `<a:${transform.op} val="${transform.val}"/>` : `<a:${transform.op}/>`
}

function baseOf(color: Color): { readonly tag: string; readonly attributes: string } {
  if ("scheme" in color) return { tag: "a:schemeClr", attributes: `val="${color.scheme}"` }
  if ("rgb" in color) return { tag: "a:srgbClr", attributes: `val="${color.rgb}"` }
  if ("system" in color) return { tag: "a:sysClr", attributes: `val="${color.system}" lastClr="${color.last}"` }
  return { tag: "a:prstClr", attributes: `val="${color.preset}"` }
}

export function colorXml(color: Color): string {
  const { tag, attributes } = baseOf(color)
  const transforms = color.transforms ?? []
  if (transforms.length === 0) return `<${tag} ${attributes}/>`
  return `<${tag} ${attributes}>${transforms.map(transformXml).join("")}</${tag}>`
}

export function solidFillXml(color: Color): string {
  return `<a:solidFill>${colorXml(color)}</a:solidFill>`
}
