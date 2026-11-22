import type { scene } from "@airdesign/document"
import { fontFamily } from "@airdesign/fonts"
import type { CSSProperties } from "react"
import { pinnedOpticalSize } from "./scene-widths.js"

type Run = scene.ResolvedRun

function runLook(run: Run): CSSProperties {
  const decoration = [run.underline ? "underline" : "", run.strike ? "line-through" : ""].filter(Boolean).join(" ")
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
  readonly lines: readonly scene.ResolvedLine[]
  readonly editing?: boolean
}) {
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
            <span key={index} data-run="" style={runLook(run)}>
              {!editing && index === line.runs.length - 1 ? run.text.trimEnd() : run.text}
            </span>
          ))}
          {editing && line.runs.length === 0 ? <br /> : null}
        </div>
      ))}
    </>
  )
}
