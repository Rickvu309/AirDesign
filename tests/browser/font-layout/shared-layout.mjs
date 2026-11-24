export async function shapeCorpus(layout, cases, prepare) {
  const rows = []
  for (const { id, lang: locale, runs } of cases) {
    let text = ""
    const styled = []
    for (const run of runs) {
      const start = text.length
      text += run.text
      const faces = []
      for (const name of run.faces) faces.push(await prepare(layout, name, { wght: run.weight, opsz: 32, ...run.axes }))
      styled.push({ range: { start, end: text.length }, faces, size: run.size, tracking: run.tracking ?? 0 })
    }
    const paragraph = {
      text,
      locale,
      direction: "auto",
      sourceOffsetByTextOffset: Array.from({ length: text.length + 1 }, (_, at) => at),
      runs: styled,
    }
    const { opportunities, graphemes } = layout.breaks(paragraph)
    const shaped = (start, end, lineEnding = "plain") =>
      layout.shapeLine({
        paragraph,
        range: { start, end },
        lineEnding,
      })
    const line = shaped(0, text.length)
    const ends = []
    const discretionaryHyphens = []
    for (const width of [85, 200, 410]) {
      const resolved = []
      for (let start = 0; start < text.length;) {
        let chosen
        for (const end of opportunities) {
          if (end <= start || !graphemes.includes(end)) continue
          const inkEnd = end - (text.slice(start, end).match(/ +$/u)?.[0].length ?? 0)
          const withHyphen = end < text.length && text[inkEnd - 1] === "\u00ad"
          const candidate = shaped(start, inkEnd, withHyphen ? "discretionary-hyphen" : "plain")
          if (candidate.kind !== "shaped") break
          if (withHyphen) discretionaryHyphens.push({ candidate, plain: shaped(start, inkEnd) })
          if (chosen !== undefined && candidate.advance > width) break
          chosen = { end, candidate }
          if (candidate.advance > width) break
        }
        if (chosen === undefined) break
        resolved.push(chosen)
        start = chosen.end
      }
      ends.push(resolved)
    }
    rows.push({ id, opportunities, graphemes, line, ends, discretionaryHyphens })
  }
  return rows
}

export async function exerciseEviction(layout, cases, prepare) {
  const rows = []
  let previous
  for (let cycle = 0; cycle < 4; cycle++) {
    for (const item of cases) {
      const [result] = await shapeCorpus(layout, [item], prepare)
      const cache = layout.cache()
      const evicted =
        previous === undefined
          ? undefined
          : layout.shapeLine({
              paragraph: previous,
              range: { start: 0, end: previous.text.length },
              lineEnding: "plain",
            })
      const run = item.runs[0]
      const face = await prepare(layout, run.faces[0], { wght: run.weight, opsz: 32 })
      previous = {
        text: run.text,
        locale: item.lang,
        direction: "auto",
        sourceOffsetByTextOffset: Array.from({ length: run.text.length + 1 }, (_, at) => at),
        runs: [{ range: { start: 0, end: run.text.length }, size: run.size, tracking: 0, faces: [face] }],
      }
      rows.push({
        id: item.id,
        line: result.line,
        cache,
        previousWasPending: evicted !== undefined && "face" in evicted,
      })
    }
  }
  return rows
}

export function observeWasmMemory() {
  const memories = new Set()
  function remember(result) {
    for (const value of Object.values((result.instance ?? result).exports)) {
      if (value instanceof WebAssembly.Memory) memories.add(value)
    }
    return result
  }
  const instantiate = WebAssembly.instantiate
  const streaming = WebAssembly.instantiateStreaming
  WebAssembly.instantiate = async (...args) => remember(await instantiate(...args))
  WebAssembly.instantiateStreaming = async (...args) => remember(await streaming(...args))
  return () => {
    WebAssembly.instantiate = instantiate
    WebAssembly.instantiateStreaming = streaming
    return [...memories].map((memory) => memory.buffer.byteLength)
  }
}
