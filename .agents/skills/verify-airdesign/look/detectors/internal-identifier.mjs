export const internalIdentifier = {
  name: "internal-identifier",
  rank: 1,
  reads:
    "visible text outside code, fields and slides: snake_case, SCREAMING_CASE, a::b names, the tool names in packages/catalog, a numbered site such as Site 3 and a raw placeholder id such as ctrTitle 0",
  cannot: "an internal word that reads as plain English, such as a one-word refusal code",
  inspect: (element, page) => {
    const text = page.ownText(element)
    if (text === "" || page.content(element)) return
    if (element.closest("code,pre,kbd,samp,input,textarea,[contenteditable]") !== null) return
    const numbered = [
      /\bSite \d+\b/,
      /\b(?:ctrTitle|subTitle|secHead|sldNum)\b(?: \d+)?/,
      /\b(?:title|body|obj|dt|ftr|hdr) \d+\b/,
    ]
    const words = text.split(/\s+/).filter((word) => !/[@/]|:\/\//.test(word))
    const tools = page.options.identifiers ?? []
    const shapes = [/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/, /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/, /^[A-Za-z]\w*(?:::\w+)+$/]
    const found = words
      .map((word) => word.replace(/^[("'`[]+|[)"'`\],.;:!?]+$/g, ""))
      .find((word) => tools.includes(word) || shapes.some((shape) => shape.test(word)))
    const name = found ?? numbered.map((shape) => shape.exec(text)?.[0]).find((match) => match !== undefined)
    if (name === undefined) return
    return `A person sees the internal name "${name}". Show what it means in plain words.`
  },
}
