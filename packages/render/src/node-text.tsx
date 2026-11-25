import * as doom from "@airdesign/doom"
import { fontFamily, pinnedOpticalSize } from "@airdesign/fonts"
import type { CSSProperties } from "react"

type Run = doom.ResolvedRun

function runLook(run: Run): CSSProperties {
  const underline = run.underline || run.link !== undefined
  const decoration = [underline ? "underline" : "", run.strike ? "line-through" : ""].filter(Boolean).join(" ")
  return {
    fontFamily: run.face === undefined ? fontFamily(run.font) : `${JSON.stringify(run.face.family)}`,
    fontSize: run.size,
    fontWeight: run.face?.weight ?? (run.bold ? 700 : 400),
    fontStyle: run.face?.style ?? (run.italic ? "italic" : "normal"),
    ...(run.face === undefined ? {} : { fontSynthesis: "none" }),
    fontVariationSettings:
      run.face === undefined ? `"opsz" ${String(pinnedOpticalSize)}` : run.face.variations || "normal",
    color: run.color,
    ...(decoration === "" ? {} : { textDecoration: decoration }),
    ...(run.tracking === 0 ? {} : { letterSpacing: run.tracking }),
    ...(run.figures === "tabular" ? { fontVariantNumeric: "tabular-nums" } : {}),
  }
}

export function TextLines({
  lines,
  editing = false,
}: {
  readonly lines: readonly doom.ResolvedLine[]
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
          dir={line.direction}
          lang={line.locale}
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
              data-font-pending={line.pending ? "" : undefined}
              {...(run.link === undefined ? {} : { "data-link": run.link })}
              style={runLook(run)}
            >
              {paintRun(line.runs, run, index, editing)}
            </span>
          ))}
          {editing && line.runs.length === 0 ? <br /> : null}
        </div>
      ))}
    </>
  )
}

function paintRun(runs: readonly Run[], run: Run, index: number, editing: boolean): string {
  const display = editing && run.display?.includes("\u2060") ? run.text : (run.display ?? run.text)
  return !editing && runs.slice(index + 1).every((next) => /^ *$/u.test(next.text))
    ? display.replace(/ +$/u, "")
    : display
}
