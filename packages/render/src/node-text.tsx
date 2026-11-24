import * as doom from "@airdesign/doom"
import { fallbackFont, fontFamily, servedFontName } from "@airdesign/fonts"
import type { CSSProperties } from "react"
import { fontsFor } from "./font-load.js"
import { pinnedOpticalSize } from "./doom-widths.js"

type Run = doom.ResolvedRun

function runLook(run: Run): CSSProperties {
  const underline = run.underline || run.link !== undefined
  const decoration = [underline ? "underline" : "", run.strike ? "line-through" : ""].filter(Boolean).join(" ")
  return {
    fontFamily: fontFamily(run.font),
    fontSize: run.size,
    fontWeight: run.bold ? 700 : 400,
    fontStyle: run.italic ? "italic" : "normal",
    fontVariationSettings: `"opsz" ${String(pinnedOpticalSize)}`,
    color: run.color,
    ...(decoration === "" ? {} : { textDecoration: decoration }),
    ...(run.tracking === 0 ? {} : { letterSpacing: run.tracking }),
  }
}

export function TextLines({
  lines,
  editing = false,
}: {
  readonly lines: readonly doom.ResolvedLine[]
  readonly editing?: boolean
}) {
  const loader = typeof document === "undefined" ? undefined : fontsFor(document)
  const pending = (run: Run) =>
    loader !== undefined && (!loader.ready(servedFontName(run.font) ?? fallbackFont) || !loader.ready(fallbackFont))
  return (
    <>
      {lines.map((line, at) => (
        <div
          key={at}
          data-line=""
          data-start={line.start}
          data-end={line.end}
          style={{
            position: "absolute",
            left: line.x,
            top: line.y,
            width: line.w,
            height: line.h,
            lineHeight: `${String(line.h)}px`,
            textAlign: line.align === "justify" ? "left" : line.align,
            whiteSpace: "pre",
            textRendering: "geometricPrecision",
          }}
        >
          {line.label === undefined ? null : (
            <span
              data-label=""
              contentEditable={editing ? false : undefined}
              style={{ position: "absolute", left: line.label.x - line.x, ...runLook(line.label.run) }}
            >
              {line.label.run.text}
            </span>
          )}
          {line.runs.map((run, index) => (
            <span
              key={index}
              data-run=""
              data-font-pending={pending(run) ? "" : undefined}
              {...(run.link === undefined ? {} : { "data-link": run.link })}
              style={runLook(run)}
            >
              {!editing && index === line.runs.length - 1 ? run.text.trimEnd() : run.text}
            </span>
          ))}
          {editing && line.runs.length === 0 ? <br /> : null}
        </div>
      ))}
    </>
  )
}
